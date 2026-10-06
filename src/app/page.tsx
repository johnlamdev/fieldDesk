import Link from "next/link";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hongKongDayBounds, formatHongKongDateTime, formatDateOnly } from "@/lib/time";
export default async function Home() {
  const user = await requireUser();
  const { start: today, end: tomorrow, dateStart, dateEnd } = hongKongDayBounds();
  const visits = await prisma.visit.findMany({
    where: {
      ...(user.role === "admin" ? {} : { assignments: { some: { userId: user.id } } }),
      OR: [{ bookedAt: { gte: today, lt: tomorrow } }, { tentativeAt: { gte: today, lt: tomorrow } }, { tentativeDate: { gte: dateStart, lt: dateEnd } }],
    },
    include: { case: true, assignments: { include: { user: true } } },
    orderBy: [{ bookedAt: "asc" }, { tentativeAt: "asc" }, { tentativeDate: "asc" }],
  });
  return <><h1>今天的上門任務</h1><p>{user.name} · {user.role}</p><section>{visits.length ? visits.map(v => <div className="staff-row" key={v.id}><p><Link href={`/visits/${v.id}`}>{v.case.customerName}</Link> · {v.type} · {v.status ?? "待確認"} · {v.bookedAt ? formatHongKongDateTime(v.bookedAt) : v.tentativeAt ? formatHongKongDateTime(v.tentativeAt) + "（待確認）" : v.tentativeDate ? formatDateOnly(v.tentativeDate) + "（待確認）" : "日期待定"}</p><p>地址：{v.case.addressRaw || "—"}<br />同行人員：{v.assignments.map(a => `${a.user.name}${a.isLead ? "（主責）" : ""}`).join("、") || "待安排"}{v.type === "安裝" && !v.assignments.some(a => a.role === "engineer" && a.isLead) && " · 待安排工程師"}</p>{v.status === "已取消" && <p>取消原因：{v.cancellationReason}</p>}{v.status === "未完成" && <p>未完成原因：{v.incompleteReason}</p>}</div>) : <p>今天沒有任務</p>}</section></>;
}
