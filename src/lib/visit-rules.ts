export type VisitKind = "現場勘察" | "安裝" | "事件處理";
export type VisitStatus = "已預約" | "已完成" | "未完成" | "已取消" | null;
export type VisitAssignmentRule = { role: string; isLead: boolean };
export function validateVisitTransition(input: {
  kind: VisitKind;
  oldStatus: VisitStatus;
  status: VisitStatus;
  bookedAt: Date | null;
  assignments: VisitAssignmentRule[];
  linkedEventCount: number;
  siteVisitConclusion: string | null;
  oldConclusion: string | null;
  incompleteReason: string | null;
  cancellationReason: string | null;
  reasonDetail: string;
  remark: string | null;
}) {
  const v = input;
  if (v.oldStatus === "已完成" && v.status !== "已完成") throw new Error("已完成任務的狀態更正尚未啟用，避免覆蓋個案狀態");
  if (v.oldStatus === "已完成" && v.kind === "現場勘察" && v.siteVisitConclusion !== v.oldConclusion) throw new Error("已完成勘察的結論更正尚未啟用");
  if (v.status === "已預約") {
    if (!v.bookedAt) throw new Error("正式預約需要日期時間");
    const roles = v.kind === "安裝" ? ["engineer", "technician"] : ["engineer"];
    if (roles.some(role => !v.assignments.some(a => a.role === role && a.isLead))) throw new Error("正式預約需要主責工程師及適用的主責師傅");
  }
  if (v.status === "已完成" && v.kind === "現場勘察") {
    if (!["可以安裝", "不能安裝"].includes(v.siteVisitConclusion ?? "")) throw new Error("勘察完成需要結論");
    if (v.siteVisitConclusion === "不能安裝" && !v.remark) throw new Error("不能安裝需要備註原因");
  }
  if (v.status === "已完成" && v.kind === "事件處理" && !v.linkedEventCount) throw new Error("事件處理完成前需要連結事件");
  if (v.status === "未完成" && v.kind !== "事件處理" && !v.incompleteReason) throw new Error("未完成需要原因");
  if (v.status === "已取消" && !v.cancellationReason) throw new Error("取消需要原因");
  if ((v.incompleteReason === "其他" || v.cancellationReason === "其他") && !v.reasonDetail) throw new Error("其他原因需要說明");
}
