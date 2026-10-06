import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";

export type Role = "admin" | "engineer" | "technician";

export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, active: true } });
  return user?.active ? user : null;
}

export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role as Role)) notFound();
  return user;
}

export function canEdit(role: string) { return role === "admin" || role === "engineer"; }
