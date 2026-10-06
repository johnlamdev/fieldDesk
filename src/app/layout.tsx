import type { Metadata } from "next";
import { Nav } from "./nav";
import "./style.css";
export const metadata: Metadata = { title: "FieldDesk", description: "虛構資料 CRM 測試版", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><header><strong>FieldDesk</strong><Nav /></header><main><p className="test-notice">測試版：只可輸入虛構資料，請勿填寫真實客戶或個人資料。</p>{children}</main></body></html>;
}
