"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { safeSubmit, type ActionName } from "@/app/actions/safe";

function PendingFields({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <><fieldset disabled={pending} aria-busy={pending}>{children}</fieldset>{pending && <span role="status">儲存中，請稍候…</span>}</>;
}

export function ActionForm({ name, children, className, formKey = "" }: { name: ActionName; children: React.ReactNode; className?: string; formKey?: string }) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("formAction") === name && (params.get("formKey") ?? "") === formKey) setMessage(params.get("formError") ?? "");
  }, [name, formKey]);
  return <form action={safeSubmit.bind(null, name)} className={className} onSubmit={() => setMessage("")}><input type="hidden" name="_returnTo" value={pathname} /><input type="hidden" name="_formKey" value={formKey} /><PendingFields>{children}</PendingFields>{message && <p className="error" role="alert" aria-live="polite">{message}</p>}</form>;
}
