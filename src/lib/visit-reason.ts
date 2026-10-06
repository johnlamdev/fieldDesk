export function splitVisitRemark(remark: string | null, hasOtherReason: boolean) {
  const value = remark ?? "";
  if (!hasOtherReason) return { remark: value, reasonDetail: "" };
  const match = value.match(/(?:^|\n)原因：([^\n]+)$/);
  if (!match) return { remark: value, reasonDetail: "" };
  return { remark: value.slice(0, match.index ?? 0).trimEnd(), reasonDetail: match[1] };
}

export function joinVisitRemark(remark: string, reasonDetail: string, needsOtherReason: boolean) {
  const base = remark.trim();
  const detail = needsOtherReason ? reasonDetail.trim() : "";
  return [base, detail ? `原因：${detail}` : ""].filter(Boolean).join("\n") || null;
}
