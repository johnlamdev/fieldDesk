import { ActionForm } from "@/app/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { archiveDevice, restoreDevice, updateDevice } from "@/app/actions/crm";
import { formatHongKongDateTime } from "@/lib/time";

export default async function DeviceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["admin", "engineer"]);
  const d = await prisma.device.findUnique({ where: { id: (await params).id }, include: { case: true, events: true } });
  if (!d) notFound();
  const deviceTypes = await prisma.deviceType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const currentTypeInList = deviceTypes.some(t => t.name === d.type);
  return <>
    <p><Link href={`/cases/${d.caseId}`}>← {d.case.customerName}</Link></p>
    <h1>設備：{d.type}</h1>
    {d.retiredAt ? <section><p>已刪除：{formatHongKongDateTime(d.retiredAt)}<br />原因：{d.retiredReason ?? "—"}</p><ActionForm name="restoreDevice"><input type="hidden" name="deviceId" value={d.id} /><button>復原設備</button></ActionForm></section> : <>
      <section><ActionForm name="updateDevice"><input type="hidden" name="deviceId" value={d.id} /><label>設備類型<select name="type" required defaultValue={d.type}>{!currentTypeInList && <option value={d.type}>{d.type}（原有類型）</option>}{deviceTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label><label>ID<input name="identifierRaw" defaultValue={d.identifierRaw ?? ""} /></label><label>SN<input name="serialRaw" defaultValue={d.serialRaw ?? ""} /></label><label>位置<input name="location" defaultValue={d.location ?? ""} /></label><label>備註<textarea name="remark" defaultValue={d.remark ?? ""} /></label><button>儲存修改</button></ActionForm><p><Link href="/settings/device-types">管理設備類型</Link></p></section>
      <section><h2>刪除設備</h2><p>設備會從個案的現用清單移除，相關事件與操作紀錄仍保留；之後可復原。</p><ActionForm name="archiveDevice"><input type="hidden" name="deviceId" value={d.id} /><label>刪除原因<input name="reason" required maxLength={500} placeholder="例如：誤建、設備已更換" /></label><button className="danger-button">刪除設備</button></ActionForm></section>
    </>}
    <section><h2>相關事件</h2>{d.events.length ? d.events.map(e => <p key={e.id}><Link href={`/events/${e.id}`}>{e.type}</Link> · {e.status}</p>) : <p>暫無相關事件</p>}</section>
  </>;
}
