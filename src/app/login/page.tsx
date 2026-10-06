"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
    const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
    if (result.error) setError(result.error.status === 429 ? "嘗試次數過多，請稍後再試。" : "登入失敗，請檢查帳號及密碼");
    else window.location.assign("/");
    } catch {
      setError("未能連線，請檢查網絡後重試。");
    } finally {
      setPending(false);
    }
  }
  return <section><h1>登入</h1><form onSubmit={submit}><label>電郵<input name="email" type="email" required autoComplete="username" /></label><label>密碼<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={pending}>{pending ? "登入中…" : "登入"}</button></form></section>;
}
