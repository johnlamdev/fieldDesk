import Link from "next/link";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatHongKongDateTime, formatDateOnly } from "@/lib/time";
export default async function Visits() {
  const user = await requireUser();
  const rows = await prisma.visit.findMany({ where: user.role === "admin" ? {} : { assignments: { some: { userId: user.id } } }, include: { case: true, assignments: { include: { user: true } } }, orderBy: [{ bookedAt: "desc" }, { tentativeAt: "desc" }, { tentativeDate: "desc" }], take: 200 });
  return <><h1>上門任務</h1>{rows.length ? <table><thead><tr><th>時間</th><th>客戶</th><th>類型</th><th>狀態</th><th>人員</th></tr></thead><tbody>{rows.map(v => <tr key={v.id}><td>{v.bookedAt ? formatHongKongDateTime(v.bookedAt) : v.tentativeAt ? formatHongKongDateTime(v.tentativeAt) : v.tentativeDate ? formatDateOnly(v.tentativeDate) : "日期待定"}{!v.bookedAt && "（待確認）"}</td><td><Link href={`/visits/${v.id}`}>{v.case.customerName}</Link><br />{v.case.addressRaw}</td><td>{v.type}</td><td>{v.status ?? "待確認"}{v.status === "已取消" && `：${v.cancellationReason ?? ""}`}</td><td>{v.assignments.map(a => `${a.user.name}${a.isLead ? "（主責）" : ""}`).join("、") || "待安排"}</td></tr>)}</tbody></table> : <section><p>{user.role === "admin" ? "目前尚未建立上門任務。" : "目前沒有指派給你的上門任務。"}</p>{user.role === "admin" && <p>先到 <Link href="/cases">個案</Link> 建立或開啟客戶個案，再於個案內新增上門任務。</p>}</section>}</>;
}
