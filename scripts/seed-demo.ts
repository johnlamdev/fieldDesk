import { createAuth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { hongKongDayBounds } from "../src/lib/time";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== "127.0.0.1" || url.port !== "5434" || url.pathname !== "/fielddesk") {
    throw new Error("示範資料只可加入本機 FieldDesk 資料庫（127.0.0.1:5434/fielddesk）");
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("請設定至少 12 字元的 DEMO_PASSWORD");
  if (await prisma.user.count() || await prisma.customerCase.count()) throw new Error("示範資料只可加入全新空資料庫");

  const auth = createAuth(true);
  const ids = new Map<string, string>();
  for (const [role, name] of [
    ["admin", "示範管理員"],
    ["engineer", "示範工程師"],
    ["technician", "示範師傅"],
  ]) {
    const email = `${role}.demo@example.com`;
    const response = await auth.api.signUpEmail({ body: { email, name, password } });
    await prisma.user.update({ where: { id: response.user.id }, data: { role } });
    ids.set(role, response.user.id);
  }

  const { start } = hongKongDayBounds();
  const at = (day: number, hour: number) => new Date(start.getTime() + (day * 24 + hour) * 60 * 60 * 1000);
  await prisma.$transaction(async tx => {
    const first = await tx.customerCase.create({ data: {
      customerName: "示範客戶 A", referenceCode: "DEMO-001", addressRaw: "示範路 1 號 2 樓",
      contactName: "示範聯絡人 A", contactPhone: "0000 0000", installationStatus: "已安排安裝", remark: "完全虛構的展示資料",
    } });
    const second = await tx.customerCase.create({ data: {
      customerName: "示範客戶 B", referenceCode: "DEMO-002", addressRaw: "樣板街 8 號",
      contactName: "示範聯絡人 B", contactPhone: "0000 0000", installationStatus: "待安排現場勘察",
    } });
    const deviceOne = await tx.device.create({ data: { caseId: first.id, type: "設備1", identifierRaw: "DEMO-DEVICE-001", serialRaw: "DEMO-SN-001", location: "客廳" } });
    await tx.device.create({ data: { caseId: first.id, type: "設備2", identifierRaw: "DEMO-DEVICE-002", serialRaw: "DEMO-SN-002", location: "大門" } });
    const event = await tx.serviceEvent.create({ data: { caseId: first.id, deviceId: deviceOne.id, type: "設備故障", status: "待處理", remark: "虛構的連線問題" } });
    const installation = await tx.visit.create({ data: { caseId: first.id, type: "安裝", status: "已預約", tentativeAt: at(0, 13), bookedAt: at(0, 14), remark: "示範安裝任務" } });
    await tx.visitAssignment.createMany({ data: [
      { visitId: installation.id, userId: ids.get("engineer")!, role: "engineer", isLead: true },
      { visitId: installation.id, userId: ids.get("technician")!, role: "technician", isLead: true },
    ] });
    const survey = await tx.visit.create({ data: { caseId: second.id, type: "現場勘察", tentativeAt: at(1, 10), remark: "等待確認日期" } });
    await tx.visitAssignment.create({ data: { visitId: survey.id, userId: ids.get("engineer")!, role: "engineer", isLead: true } });
    const incident = await tx.visit.create({ data: { caseId: first.id, type: "事件處理", tentativeAt: at(1, 15) } });
    await tx.visitEvent.create({ data: { visitId: incident.id, eventId: event.id } });
    await tx.auditLog.create({ data: { actorId: ids.get("admin")!, action: "seed", entityType: "demo", entityId: first.id, after: { synthetic: true, caseIds: [first.id, second.id] } } });
  });
  console.log("已加入虛構示範資料。登入電郵：admin.demo@example.com、engineer.demo@example.com、technician.demo@example.com");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
