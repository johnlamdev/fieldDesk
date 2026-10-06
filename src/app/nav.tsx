"use client";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
export function Nav() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span role="status">載入中…</span>;
  if (!data) return null;
  const role = (data.user as { role?: string }).role;
  return <nav><Link href="/">首頁</Link>{role !== "technician" && <><Link href="/cases">個案</Link><Link href="/settings/device-types">設備類型</Link></>}<Link href="/visits">上門任務</Link>{role === "admin" && <Link href="/admin/users">人員</Link>}<button type="button" onClick={async () => { await authClient.signOut(); window.location.assign("/login"); }}>登出</button></nav>;
}
