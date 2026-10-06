import test from "node:test";
import assert from "node:assert/strict";
import { validateVisitTransition } from "../src/lib/visit-rules";
const base = { kind: "安裝" as const, oldStatus: null, status: "已預約" as const, bookedAt: new Date("2026-10-04T10:00:00+08:00"), assignments: [{ role: "engineer", isLead: true }, { role: "technician", isLead: true }], linkedEventCount: 0, siteVisitConclusion: null, oldConclusion: null, incompleteReason: null, cancellationReason: null, reasonDetail: "", remark: null };
test("confirmed installation needs both lead roles", () => {
  assert.doesNotThrow(() => validateVisitTransition(base));
  assert.throws(() => validateVisitTransition({ ...base, assignments: base.assignments.slice(0,1) }), /主責/);
});
test("site survey completion needs conclusion and reason", () => {
  assert.throws(() => validateVisitTransition({ ...base, kind: "現場勘察", status: "已完成", siteVisitConclusion: null }), /結論/);
  assert.throws(() => validateVisitTransition({ ...base, kind: "現場勘察", status: "已完成", siteVisitConclusion: "不能安裝" }), /備註/);
});
test("incident completion requires linked event", () => {
  assert.throws(() => validateVisitTransition({ ...base, kind: "事件處理", status: "已完成" }), /連結事件/);
});
test("completed installation cannot be reversed without case restoration", () => {
  assert.throws(() => validateVisitTransition({ ...base, oldStatus: "已完成" }), /更正/);
});
