"use server";
import { requireUser } from "@/lib/access";
import { createAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { z } from "zod";

const roleInput = z.enum(["admin", "engineer", "technician"]);
const emailInput = z.email().max(320);

export async function createStaff(form: FormData) {
  const actor = await requireUser(["admin"]);
  const email = emailInput.parse(String(form.get("email") ?? "").trim().toLowerCase());
  const name = z.string().trim().min(1).max(150).parse(form.get("name"));
  const role = roleInput.parse(form.get("role"));
  const password = z.string().min(12).parse(form.get("password"));
  if (await prisma.user.findUnique({ where: { email } })) throw new Error("電郵已被使用");
  const response = await createAuth(true).api.signUpEmail({ body: { email, name, password } });
  await prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: response.user.id }, data: { role } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "user", entityId: response.user.id, after: { email, name, role, active: true } } });
  });
  redirect("/admin/users");
}

export async function updateStaff(form: FormData) {
  const actor = await requireUser(["admin"]);
  const id = z.string().min(1).parse(form.get("id"));
  const name = z.string().trim().min(1).max(150).parse(form.get("name"));
  const role = roleInput.parse(form.get("role"));
  const active = form.get("active") === "on";
  if (id === actor.id && (!active || role !== "admin")) throw new Error("不可停用自己的管理員帳號或移除自己的管理員權限");
  await prisma.$transaction(async tx => {
    const before = await tx.user.findUniqueOrThrow({ where: { id } });
    if (before.role !== role && await tx.visitAssignment.count({ where: { userId: id } })) throw new Error("此人員已有上門指派；請先移除或改派，才能更改角色");
    if (before.active && !active && await tx.visitAssignment.count({ where: { userId: id, visit: { status: { in: ["已預約"] } } } })) throw new Error("此人員仍有已預約任務；請先改派，才能停用");
    if (before.role === "admin" && (role !== "admin" || !active)) {
      const otherAdmins = await tx.user.count({ where: { role: "admin", active: true, id: { not: id } } });
      if (!otherAdmins) throw new Error("必須保留至少一位啟用中的管理員");
    }
    await tx.user.update({ where: { id }, data: { name, role, active } });
    if (!active || role !== before.role) await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "user", entityId: id, before: { name: before.name, role: before.role, active: before.active }, after: { name, role, active } } });
  });
  redirect("/admin/users");
}
