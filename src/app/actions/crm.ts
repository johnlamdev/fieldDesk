"use server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { redirect } from "next/navigation";
import { z } from "zod";
import { validateVisitTransition, type VisitKind, type VisitStatus } from "@/lib/visit-rules";
import { parseHongKongLocalDateTime, tentativeDateFromInput } from "@/lib/time";
import { assertCompletionCanBeReversed, completionSnapshotSchema } from "@/lib/completion";
import { joinVisitRemark } from "@/lib/visit-reason";
import { Prisma } from "@prisma/client";

const caseInput = z.object({ customerName: z.string().trim().min(1).max(150), addressRaw: z.string().trim().max(1000), referenceCode: z.string().trim().max(100), contactName: z.string().trim().max(150), contactPhone: z.string().trim().max(100), remark: z.string().trim().max(5000) });
const visitTypes = ["現場勘察", "安裝", "事件處理"] as const;
const statuses = ["已預約", "已完成", "未完成", "已取消"] as const;

export async function createCase(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const input = caseInput.parse(Object.fromEntries(["customerName", "addressRaw", "referenceCode", "contactName", "contactPhone", "remark"].map(k => [k, String(form.get(k) ?? "")])));
  const result = await prisma.$transaction(async tx => {
    const row = await tx.customerCase.create({ data: { ...input, referenceCode: input.referenceCode || null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "customer_case", entityId: row.id, after: input } });
    return row;
  });
  redirect(`/cases/${result.id}`);
}

export async function updateCase(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("caseId"));
  const input = caseInput.parse(Object.fromEntries(["customerName", "addressRaw", "referenceCode", "contactName", "contactPhone", "remark"].map(k => [k, String(form.get(k) ?? "")])));
  const data = { ...input, referenceCode: input.referenceCode || null };
  await prisma.$transaction(async tx => {
    const before = await tx.customerCase.findUniqueOrThrow({ where: { id } });
    if (before.archivedAt) throw new Error("已封存個案不可修改；請先復原");
    await tx.customerCase.update({ where: { id }, data });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "customer_case", entityId: id, before: { customerName: before.customerName, addressRaw: before.addressRaw, referenceCode: before.referenceCode, contactName: before.contactName, contactPhone: before.contactPhone, remark: before.remark }, after: data } });
  });
  redirect(`/cases/${id}`);
}

export async function archiveCase(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("caseId"));
  const reason = z.string().trim().min(1).max(500).parse(form.get("reason"));
  await prisma.$transaction(async tx => {
    const before = await tx.customerCase.findUniqueOrThrow({ where: { id } });
    if (before.archivedAt) throw new Error("個案已封存");
    const activeVisits = await tx.visit.count({ where: { caseId: id, OR: [{ status: null }, { status: "已預約" }] } });
    if (activeVisits) throw new Error("個案仍有待處理或已預約任務；請先處理任務");
    const activeEvents = await tx.serviceEvent.count({ where: { caseId: id, status: { in: ["待處理", "處理中"] } } });
    if (activeEvents) throw new Error("個案仍有待處理事件；請先處理事件");
    const archivedAt = new Date();
    await tx.customerCase.update({ where: { id }, data: { archivedAt, archivedReason: reason } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "archive", entityType: "customer_case", entityId: id, after: { archivedAt, archivedReason: reason } } });
  });
  redirect("/cases");
}

export async function restoreCase(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("caseId"));
  await prisma.$transaction(async tx => {
    const before = await tx.customerCase.findUniqueOrThrow({ where: { id } });
    if (!before.archivedAt) throw new Error("個案未封存");
    await tx.customerCase.update({ where: { id }, data: { archivedAt: null, archivedReason: null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "restore", entityType: "customer_case", entityId: id, before: { archivedAt: before.archivedAt, archivedReason: before.archivedReason } } });
  });
  redirect(`/cases/${id}`);
}

export async function createVisit(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const caseId = z.string().uuid().parse(form.get("caseId"));
  const type = z.enum(visitTypes).parse(form.get("type"));
  const tentative = String(form.get("tentativeAt") ?? "");
  const tentativeAt = parseHongKongLocalDateTime(tentative);
  const tentativeDate = tentativeDateFromInput(tentative);
  const row = await prisma.$transaction(async tx => {
    if (!await tx.customerCase.findFirst({ where: { id: caseId, archivedAt: null } })) throw new Error("個案不存在或已封存");
    const visit = await tx.visit.create({ data: { caseId, type, tentativeDate, tentativeAt } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "visit", entityId: visit.id, after: { caseId, type, tentativeAt } } });
    return visit;
  });
  redirect(`/visits/${row.id}`);
}

export async function assignVisit(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const userId = z.string().parse(form.get("userId"));
  const isLead = form.get("isLead") === "on";
  const person = await prisma.user.findFirst({ where: { id: userId, active: true } });
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!person || !visit || !["engineer", "technician"].includes(person.role)) throw new Error("無效指派");
  if (person.role === "technician" && visit.type !== "安裝") throw new Error("師傅只可指派安裝任務");
  await prisma.$transaction(async tx => {
    const before = await tx.visitAssignment.findMany({ where: { visitId } });
    if (isLead) await tx.visitAssignment.updateMany({ where: { visitId, role: person.role }, data: { isLead: false } });
    await tx.visitAssignment.upsert({ where: { visitId_userId: { visitId, userId } }, create: { visitId, userId, role: person.role, isLead }, update: { isLead } });
    const after = await tx.visitAssignment.findMany({ where: { visitId } });
    if (visit.status === "已預約") {
      const requiredRoles = visit.type === "安裝" ? ["engineer", "technician"] : ["engineer"];
      if (requiredRoles.some(role => !after.some(a => a.role === role && a.isLead))) throw new Error("已預約任務必須保留主責人員");
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "assign", entityType: "visit", entityId: visitId, before, after } });
  });
  redirect(`/visits/${visitId}`);
}

export async function removeVisitAssignment(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const userId = z.string().min(1).parse(form.get("userId"));
  await prisma.$transaction(async tx => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    const assignment = await tx.visitAssignment.findUniqueOrThrow({ where: { visitId_userId: { visitId, userId } } });
    if (visit.status === "已預約" && assignment.isLead) throw new Error("已預約任務須先改派主責人員，或將任務改為待確認");
    await tx.visitAssignment.delete({ where: { visitId_userId: { visitId, userId } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "unassign", entityType: "visit", entityId: visitId, before: { userId, role: assignment.role, isLead: assignment.isLead } } });
  });
  redirect(`/visits/${visitId}`);
}

export async function updateVisit(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const statusRaw = String(form.get("status") ?? "");
  const status = statusRaw ? z.enum(statuses).parse(statusRaw) : null;
  const tentativeRaw = String(form.get("tentativeAt") ?? "");
  const tentativeAt = parseHongKongLocalDateTime(tentativeRaw);
  const tentativeDate = tentativeDateFromInput(tentativeRaw);
  const bookedRaw = String(form.get("bookedAt") ?? "");
  const bookedAt = parseHongKongLocalDateTime(bookedRaw);
  const conclusion = status === "已完成" ? String(form.get("siteVisitConclusion") ?? "") || null : null;
  const incompleteReason = status === "未完成" ? String(form.get("incompleteReason") ?? "") || null : null;
  const cancellationReason = status === "已取消" ? String(form.get("cancellationReason") ?? "") || null : null;
  const reasonDetail = String(form.get("reasonDetail") ?? "").trim();
  const remark = joinVisitRemark(String(form.get("remark") ?? ""), reasonDetail, incompleteReason === "其他" || cancellationReason === "其他");
  await prisma.$transaction(async tx => {
    const old = await tx.visit.findUnique({ where: { id: visitId }, include: { assignments: true, events: true } });
    if (!old) throw new Error("任務不存在");
    validateVisitTransition({
      kind: old.type as VisitKind, oldStatus: old.status as VisitStatus,
      status, bookedAt, assignments: old.assignments, linkedEventCount: old.events.length,
      siteVisitConclusion: conclusion, oldConclusion: old.siteVisitConclusion,
      incompleteReason, cancellationReason, reasonDetail, remark,
    });
    let installationStatus: string | undefined;
    let serviceStatus: string | undefined;
    if (old.status !== status) {
      if (status === "已預約" && old.type === "現場勘察") installationStatus = "已安排現場勘察";
      if (status === "已預約" && old.type === "安裝") installationStatus = "已安排安裝";
      if (status === "已完成" && old.type === "現場勘察") installationStatus = conclusion === "可以安裝" ? "待安排安裝" : "已終止";
      if (status === "已完成" && old.type === "安裝") { installationStatus = "已完成安裝"; serviceStatus = "服務中"; }
    }
    const caseBefore = installationStatus ? await tx.customerCase.findUniqueOrThrow({ where: { id: old.caseId } }) : null;
    const completionSnapshot = status === "已完成" && old.status !== "已完成" && caseBefore ? {
      previousVisitStatus: old.status,
      beforeInstallationStatus: caseBefore.installationStatus,
      beforeServiceStatus: caseBefore.serviceStatus,
      afterInstallationStatus: installationStatus ?? null,
      afterServiceStatus: serviceStatus ?? caseBefore.serviceStatus,
      completedAt: new Date().toISOString(),
    } : undefined;
    const data = { status, tentativeAt, tentativeDate: tentativeAt ? tentativeDate : old.tentativeAt ? null : old.tentativeDate, bookedAt, siteVisitConclusion: conclusion, incompleteReason, cancellationReason, remark };
    await tx.visit.update({ where: { id: visitId }, data });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "visit", entityId: visitId, before: { status: old.status, tentativeAt: old.tentativeAt, tentativeDate: old.tentativeDate, bookedAt: old.bookedAt, siteVisitConclusion: old.siteVisitConclusion, incompleteReason: old.incompleteReason, cancellationReason: old.cancellationReason, remark: old.remark }, after: data } });
    if (installationStatus && caseBefore) {
      await tx.customerCase.update({ where: { id: old.caseId }, data: { installationStatus, ...(serviceStatus ? { serviceStatus } : {}) } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "status_update", entityType: "customer_case", entityId: old.caseId, before: { installationStatus: caseBefore.installationStatus, serviceStatus: caseBefore.serviceStatus }, after: { installationStatus, serviceStatus: serviceStatus ?? caseBefore.serviceStatus } } });
    }
    if (completionSnapshot) {
      await tx.visit.update({ where: { id: visitId }, data: { completionSnapshot: { ...completionSnapshot, completedAt: new Date().toISOString() } } });
    }
  }, { isolationLevel: "Serializable" });
  redirect(`/visits/${visitId}`);
}

export async function correctCompletedVisit(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const reason = z.string().trim().min(1).max(500).parse(form.get("reason"));
  await prisma.$transaction(async tx => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    if (visit.status !== "已完成" || !["安裝", "現場勘察"].includes(visit.type) || !visit.completionSnapshot) throw new Error("此任務沒有可自動回復的完成紀錄");
    const snapshot = completionSnapshotSchema.parse(visit.completionSnapshot);
    const customerCase = await tx.customerCase.findUniqueOrThrow({ where: { id: visit.caseId } });
    const newerStatusChange = await tx.auditLog.findFirst({ where: { entityType: "customer_case", entityId: visit.caseId, action: "status_update", occurredAt: { gt: new Date(snapshot.completedAt) } }, select: { id: true } });
    assertCompletionCanBeReversed(snapshot, customerCase, !!newerStatusChange);
    await tx.visit.update({ where: { id: visitId }, data: { status: snapshot.previousVisitStatus, completionSnapshot: Prisma.DbNull, ...(visit.type === "現場勘察" ? { siteVisitConclusion: null } : {}) } });
    await tx.customerCase.update({ where: { id: visit.caseId }, data: { installationStatus: snapshot.beforeInstallationStatus, serviceStatus: snapshot.beforeServiceStatus } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "completion_correction", entityType: "visit", entityId: visitId, before: { status: visit.status, siteVisitConclusion: visit.siteVisitConclusion }, after: { status: snapshot.previousVisitStatus, reason } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "status_restore", entityType: "customer_case", entityId: visit.caseId, before: { installationStatus: customerCase.installationStatus, serviceStatus: customerCase.serviceStatus }, after: { installationStatus: snapshot.beforeInstallationStatus, serviceStatus: snapshot.beforeServiceStatus } } });
  }, { isolationLevel: "Serializable" });
  redirect(`/visits/${visitId}`);
}

const deviceInput = z.object({ type: z.string().trim().min(1).max(100), identifierRaw: z.string().trim().max(200), serialRaw: z.string().trim().max(200), location: z.string().trim().max(500), remark: z.string().trim().max(5000) });
const eventTypes = ["設備離線／連線異常", "設備故障", "告警／誤報", "客戶求助", "其他"] as const;
const eventStatuses = ["待處理", "處理中", "已解決", "已取消"] as const;

export async function createDevice(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const caseId = z.string().uuid().parse(form.get("caseId"));
  const input = deviceInput.parse(Object.fromEntries(["type", "identifierRaw", "serialRaw", "location", "remark"].map(k => [k, String(form.get(k) ?? "")])));
  const row = await prisma.$transaction(async tx => {
    if (!await tx.customerCase.findFirst({ where: { id: caseId, archivedAt: null } })) throw new Error("個案不存在或已封存");
    if (!await tx.deviceType.findFirst({ where: { name: input.type, active: true } })) throw new Error("請選擇有效的設備類型");
    const device = await tx.device.create({ data: { caseId, ...input } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "device", entityId: device.id, after: { caseId, ...input } } });
    return device;
  });
  redirect(`/devices/${row.id}`);
}

export async function updateDevice(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("deviceId"));
  const input = deviceInput.parse(Object.fromEntries(["type", "identifierRaw", "serialRaw", "location", "remark"].map(k => [k, String(form.get(k) ?? "")])));
  await prisma.$transaction(async tx => {
    const before = await tx.device.findUniqueOrThrow({ where: { id } });
    if (before.retiredAt) throw new Error("已刪除設備不可修改；請先復原");
    if (input.type !== before.type && !await tx.deviceType.findFirst({ where: { name: input.type, active: true } })) throw new Error("請選擇有效的設備類型");
    await tx.device.update({ where: { id }, data: input });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "device", entityId: id, before: { type: before.type, identifierRaw: before.identifierRaw, serialRaw: before.serialRaw, location: before.location, remark: before.remark }, after: input } });
  });
  redirect(`/devices/${id}`);
}

export async function archiveDevice(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("deviceId"));
  const reason = z.string().trim().min(1).max(500).parse(form.get("reason"));
  const caseId = await prisma.$transaction(async tx => {
    const before = await tx.device.findUniqueOrThrow({ where: { id } });
    if (before.retiredAt) throw new Error("設備已刪除");
    const retiredAt = new Date();
    await tx.device.update({ where: { id }, data: { retiredAt, retiredReason: reason } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "archive", entityType: "device", entityId: id, before: { retiredAt: before.retiredAt, retiredReason: before.retiredReason }, after: { retiredAt, retiredReason: reason } } });
    return before.caseId;
  });
  redirect(`/cases/${caseId}`);
}

export async function restoreDevice(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("deviceId"));
  await prisma.$transaction(async tx => {
    const before = await tx.device.findUniqueOrThrow({ where: { id } });
    if (!before.retiredAt) throw new Error("設備並未刪除");
    await tx.device.update({ where: { id }, data: { retiredAt: null, retiredReason: null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "restore", entityType: "device", entityId: id, before: { retiredAt: before.retiredAt, retiredReason: before.retiredReason }, after: { retiredAt: null, retiredReason: null } } });
  });
  redirect(`/devices/${id}`);
}

const deviceTypeName = z.string().trim().min(1).max(100);

export async function addDeviceType(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const name = deviceTypeName.parse(form.get("name"));
  await prisma.$transaction(async tx => {
    if (await tx.deviceType.findUnique({ where: { name } })) throw new Error("設備類型已存在");
    const last = await tx.deviceType.aggregate({ _max: { sortOrder: true } });
    const row = await tx.deviceType.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "device_type", entityId: row.id, after: { name, active: true } } });
  });
  redirect("/settings/device-types");
}

export async function updateDeviceType(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("id"));
  const name = deviceTypeName.parse(form.get("name"));
  const active = form.get("active") === "on";
  await prisma.$transaction(async tx => {
    const before = await tx.deviceType.findUniqueOrThrow({ where: { id } });
    if (name !== before.name && await tx.deviceType.findUnique({ where: { name } })) throw new Error("設備類型已存在");
    await tx.deviceType.update({ where: { id }, data: { name, active } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "device_type", entityId: id, before: { name: before.name, active: before.active }, after: { name, active } } });
  });
  redirect("/settings/device-types");
}

export async function createEvent(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const caseId = z.string().uuid().parse(form.get("caseId"));
  const type = z.enum(eventTypes).parse(form.get("type"));
  const deviceRaw = String(form.get("deviceId") ?? "");
  const deviceId = deviceRaw ? z.string().uuid().parse(deviceRaw) : null;
  const remark = String(form.get("remark") ?? "").trim().slice(0,5000) || null;
  if (type === "其他" && !remark) throw new Error("其他事件類型需要說明");
  if (deviceId && !await prisma.device.findFirst({ where: { id: deviceId, caseId, retiredAt: null } })) throw new Error("設備不屬於此個案或已刪除");
  const row = await prisma.$transaction(async tx => {
    if (!await tx.customerCase.findFirst({ where: { id: caseId, archivedAt: null } })) throw new Error("個案不存在或已封存");
    const event = await tx.serviceEvent.create({ data: { caseId, type, deviceId, remark } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "create", entityType: "event", entityId: event.id, after: { caseId, type, deviceId, remark } } });
    return event;
  });
  redirect(`/events/${row.id}`);
}

export async function updateEvent(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const id = z.string().uuid().parse(form.get("eventId"));
  const status = z.enum(eventStatuses).parse(form.get("status"));
  const type = z.enum(eventTypes).parse(form.get("type"));
  const deviceRaw = String(form.get("deviceId") ?? "");
  const deviceId = deviceRaw ? z.string().uuid().parse(deviceRaw) : null;
  const remark = String(form.get("remark") ?? "").trim().slice(0,5000) || null;
  if (type === "其他" && !remark) throw new Error("其他事件類型需要說明");
  await prisma.$transaction(async tx => {
    const before = await tx.serviceEvent.findUniqueOrThrow({ where: { id } });
    if (deviceId && deviceId !== before.deviceId && !await tx.device.findFirst({ where: { id: deviceId, caseId: before.caseId, retiredAt: null } })) throw new Error("設備不屬於此個案或已刪除");
    await tx.serviceEvent.update({ where: { id }, data: { type, deviceId, status, remark } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "update", entityType: "event", entityId: id, before: { type: before.type, deviceId: before.deviceId, status: before.status, remark: before.remark }, after: { type, deviceId, status, remark } } });
  });
  redirect(`/events/${id}`);
}

export async function linkEvent(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const eventId = z.string().uuid().parse(form.get("eventId"));
  await prisma.$transaction(async tx => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    const event = await tx.serviceEvent.findUniqueOrThrow({ where: { id: eventId } });
    if (visit.caseId !== event.caseId) throw new Error("事件與任務必須屬於同一個案");
    await tx.visitEvent.upsert({ where: { visitId_eventId: { visitId, eventId } }, create: { visitId, eventId }, update: {} });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "link", entityType: "event", entityId: eventId, after: { visitId } } });
  });
  redirect(`/events/${eventId}`);
}

export async function unlinkEvent(form: FormData) {
  const actor = await requireUser(["admin", "engineer"]);
  const visitId = z.string().uuid().parse(form.get("visitId"));
  const eventId = z.string().uuid().parse(form.get("eventId"));
  await prisma.$transaction(async tx => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId }, include: { events: true } });
    if (visit.type === "事件處理" && visit.status === "已完成" && visit.events.length <= 1) throw new Error("已完成的事件處理任務必須保留至少一筆相關事件");
    await tx.visitEvent.delete({ where: { visitId_eventId: { visitId, eventId } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "unlink", entityType: "event", entityId: eventId, before: { visitId } } });
  });
  redirect(`/events/${eventId}`);
}
