import { ActionForm } from "@/app/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { updateEvent, linkEvent, unlinkEvent } from "@/app/actions/crm";
export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["admin", "engineer"]);
  const e = await prisma.serviceEvent.findUnique({ where: { id: (await params).id }, include: { case: true, device: true, visits: { include: { visit: true } } } });
  if (!e) notFound();
  const available = await prisma.visit.findMany({ where: { caseId: e.caseId, id: { notIn: e.visits.map(v => v.visitId) } }, orderBy: { createdAt: "desc" } });
  const devices = await prisma.device.findMany({ where: { caseId: e.caseId, retiredAt: null }, orderBy: { createdAt: "asc" } });
  return <><p><Link href={`/cases/${e.caseId}`}>← {e.case.customerName}</Link></p><h1>事件：{e.type}</h1><section><ActionForm name="updateEvent"><input type="hidden" name="eventId" value={e.id} /><label>類型<select name="type" defaultValue={e.type}><option>設備離線／連線異常</option><option>設備故障</option><option>告警／誤報</option><option>客戶求助</option><option>其他</option></select></label><label>設備<select name="deviceId" defaultValue={e.deviceId ?? ""}><option value="">未指定</option>{e.device?.retiredAt && <option value={e.device.id}>{e.device.type}（已刪除設備）</option>}{devices.map(d => <option key={d.id} value={d.id}>{d.type} · {d.identifierRaw}</option>)}</select></label><label>狀態<select name="status" defaultValue={e.status}><option>待處理</option><option>處理中</option><option>已解決</option><option>已取消</option></select></label><label>備註<textarea name="remark" defaultValue={e.remark ?? ""} /></label><button>儲存</button></ActionForm></section><section><h2>相關上門任務</h2>{e.visits.map(v => <div key={v.visitId}><Link href={`/visits/${v.visitId}`}>{v.visit.type}</Link> · {v.visit.status ?? "待確認"} <ActionForm name="unlinkEvent" className="inline-form"><input type="hidden" name="eventId" value={e.id} /><input type="hidden" name="visitId" value={v.visitId} /><button className="secondary-button">取消連結</button></ActionForm></div>)}<ActionForm name="linkEvent"><input type="hidden" name="eventId" value={e.id} /><label>連結任務<select name="visitId">{available.map(v => <option key={v.id} value={v.id}>{v.type} · {v.status ?? "待確認"}</option>)}</select></label><button disabled={!available.length}>連結</button></ActionForm></section></>;
}
