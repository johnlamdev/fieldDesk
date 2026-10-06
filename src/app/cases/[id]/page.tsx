import { ActionForm } from "@/app/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatHongKongDateTime, formatDateOnly } from "@/lib/time";
import { archiveCase, createDevice, createEvent, createVisit, restoreCase, updateCase } from "@/app/actions/crm";

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["admin", "engineer"]);
  const c = await prisma.customerCase.findUnique({
    where: { id: (await params).id },
    include: { devices: true, visits: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();
  const deviceTypes = await prisma.deviceType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <>
    <p><Link href="/cases">← 個案</Link></p>
    <h1>{c.customerName}</h1>
    <section><p>地址：{c.addressRaw ?? "—"}<br />參考編號：{c.referenceCode ?? "—"}<br />聯絡人：{c.contactName ?? "—"} {c.contactPhone}<br />安裝狀態：{c.installationStatus ?? "—"}<br />服務狀態：{c.serviceStatus ?? "—"}</p><p>{c.remark}</p></section>
    {c.archivedAt ? <section><p>個案已封存：{formatHongKongDateTime(c.archivedAt)}<br />原因：{c.archivedReason}</p><ActionForm name="restoreCase"><input type="hidden" name="caseId" value={c.id} /><button>復原個案</button></ActionForm></section> : <section><details><summary>封存個案</summary><p>個案、設備、任務和事件歷史會保留；仍有未結任務或事件時不能封存。</p><ActionForm name="archiveCase"><input type="hidden" name="caseId" value={c.id} /><label>原因<input name="reason" required maxLength={500} /></label><button className="danger-button">封存個案</button></ActionForm></details></section>}
    {!c.archivedAt && <section><details><summary>修改個案資料</summary><ActionForm name="updateCase"><input type="hidden" name="caseId" value={c.id} /><label>姓名<input name="customerName" required defaultValue={c.customerName} /></label><label>地址<input name="addressRaw" defaultValue={c.addressRaw ?? ""} /></label><label>參考編號<input name="referenceCode" defaultValue={c.referenceCode ?? ""} /></label><label>聯絡人<input name="contactName" defaultValue={c.contactName ?? ""} /></label><label>電話<input name="contactPhone" defaultValue={c.contactPhone ?? ""} /></label><label>備註<textarea name="remark" defaultValue={c.remark ?? ""} /></label><button>儲存個案</button></ActionForm></details></section>}
    <section><h2>設備</h2>{c.devices.filter(d => !d.retiredAt).map(d => <p key={d.id}><Link href={`/devices/${d.id}`}>{d.type}</Link> · {d.identifierRaw} · {d.serialRaw} · {d.location}</p>)}{!c.archivedAt && <><h3>新增設備</h3><ActionForm name="createDevice"><input type="hidden" name="caseId" value={c.id} /><label>設備類型<select name="type" required defaultValue=""><option value="" disabled>請選擇設備類型</option>{deviceTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label><label>ID<input name="identifierRaw" /></label><label>SN<input name="serialRaw" /></label><label>位置<input name="location" /></label><label>備註<textarea name="remark" /></label><button disabled={!deviceTypes.length}>新增設備</button></ActionForm><p><Link href="/settings/device-types">管理設備類型</Link></p></>}{c.devices.some(d => d.retiredAt) && <details><summary>已刪除設備（可復原）</summary>{c.devices.filter(d => d.retiredAt).map(d => <p key={d.id}><Link href={`/devices/${d.id}`}>{d.type}</Link> · {d.identifierRaw} · {d.retiredReason}</p>)}</details>}</section>
    <section><h2>上門任務</h2>{c.visits.map(v => <p key={v.id}><Link href={`/visits/${v.id}`}>{v.type}</Link> · {v.status ?? "待確認"} · {v.bookedAt ? formatHongKongDateTime(v.bookedAt) : v.tentativeAt ? formatHongKongDateTime(v.tentativeAt) + "（待確認）" : v.tentativeDate ? formatDateOnly(v.tentativeDate) + "（待確認）" : "日期待定"}</p>)}{!c.archivedAt && <ActionForm name="createVisit"><input type="hidden" name="caseId" value={c.id} /><label>類型<select name="type"><option>現場勘察</option><option>安裝</option><option>事件處理</option></select></label><label>預計日期及時間<input type="datetime-local" name="tentativeAt" /></label><p>這是待確認時間；正式預約可在任務詳情更新。</p><button>新增上門任務</button></ActionForm>}</section>
    <section><h2>事件</h2>{c.events.map(e => <p key={e.id}><Link href={`/events/${e.id}`}>{e.type}</Link> · {e.status} · {e.remark}</p>)}{!c.archivedAt && <><h3>新增事件</h3><ActionForm name="createEvent"><input type="hidden" name="caseId" value={c.id} /><label>類型<select name="type"><option>設備離線／連線異常</option><option>設備故障</option><option>告警／誤報</option><option>客戶求助</option><option>其他</option></select></label><label>設備<select name="deviceId"><option value="">未指定</option>{c.devices.filter(d => !d.retiredAt).map(d => <option key={d.id} value={d.id}>{d.type} · {d.identifierRaw}</option>)}</select></label><label>備註<textarea name="remark" /></label><button>新增事件</button></ActionForm></>}</section>
  </>;
}
