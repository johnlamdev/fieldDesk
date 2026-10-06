import { ActionForm } from "@/app/action-form";
import Link from "next/link";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { createCase } from "@/app/actions/crm";
export default async function Cases({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  await requireUser(["admin", "engineer"]);
  const { q: rawQ, archived } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const showArchived = archived === "1";
  const cases = await prisma.customerCase.findMany({ where: { archivedAt: showArchived ? { not: null } : null, ...(q ? { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { addressRaw: { contains: q, mode: "insensitive" } }, { referenceCode: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: { customerName: "asc" }, take: 100 });
  return <><h1>客戶個案</h1><p><Link href="/cases">現用個案</Link> · <Link href="/cases?archived=1">已封存個案</Link></p><form><input name="q" defaultValue={q} placeholder="姓名、地址或參考編號" />{showArchived && <input type="hidden" name="archived" value="1" />}<button>搜尋</button></form><table><thead><tr><th>姓名</th><th>參考編號</th><th>地址</th><th>狀態</th></tr></thead><tbody>{cases.map(c => <tr key={c.id}><td><Link href={`/cases/${c.id}`}>{c.customerName}</Link></td><td>{c.referenceCode}</td><td>{c.addressRaw}</td><td>{showArchived ? "已封存" : c.installationStatus}</td></tr>)}</tbody></table>{!cases.length && <p>沒有相關個案。</p>}{!showArchived && <section><h2>新增個案</h2><ActionForm name="createCase"><label>姓名<input name="customerName" required /></label><label>地址<input name="addressRaw" /></label><label>參考編號<input name="referenceCode" /></label><label>聯絡人<input name="contactName" /></label><label>電話<input name="contactPhone" /></label><label>備註<textarea name="remark" /></label><button>建立</button></ActionForm></section>}</>;
}
