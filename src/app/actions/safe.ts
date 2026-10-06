"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import * as crm from "./crm";
import * as users from "./users";

const actions = {
  createCase: crm.createCase,
  updateCase: crm.updateCase,
  archiveCase: crm.archiveCase,
  restoreCase: crm.restoreCase,
  createVisit: crm.createVisit,
  assignVisit: crm.assignVisit,
  removeVisitAssignment: crm.removeVisitAssignment,
  updateVisit: crm.updateVisit,
  correctCompletedVisit: crm.correctCompletedVisit,
  createDevice: crm.createDevice,
  updateDevice: crm.updateDevice,
  archiveDevice: crm.archiveDevice,
  restoreDevice: crm.restoreDevice,
  addDeviceType: crm.addDeviceType,
  updateDeviceType: crm.updateDeviceType,
  createEvent: crm.createEvent,
  updateEvent: crm.updateEvent,
  linkEvent: crm.linkEvent,
  unlinkEvent: crm.unlinkEvent,
  createStaff: users.createStaff,
  updateStaff: users.updateStaff,
};

export type ActionName = keyof typeof actions;
export async function safeSubmit(name: ActionName, form: FormData): Promise<void> {
  let message = "操作未完成，請檢查資料後重試。";
  try {
    await actions[name](form);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) message = "輸入資料不正確，請檢查必填欄位及格式。";
    else if (error instanceof Prisma.PrismaClientKnownRequestError) message = error.code === "P2002" ? "資料已存在，請檢查重複的 ID 或電郵。" : "資料未能儲存，請稍後重試。";
    else if (error instanceof Error && !/prisma|database|sql|stack/i.test(error.message)) message = error.message.slice(0, 200);
  }
  const returnTo = String(form.get("_returnTo") ?? "/");
  const formKey = String(form.get("_formKey") ?? "").slice(0, 100);
  const requestedPath = returnTo.split("?")[0];
  const path = /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(requestedPath) ? requestedPath : "/";
  redirect(`${path}?formAction=${encodeURIComponent(name)}&formKey=${encodeURIComponent(formKey)}&formError=${encodeURIComponent(message)}`);
}
