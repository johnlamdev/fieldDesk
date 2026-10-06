import test from "node:test";
import assert from "node:assert/strict";
import { joinVisitRemark, splitVisitRemark } from "../src/lib/visit-reason";

test("other reason is editable without duplicating it in the remark", () => {
  const stored = joinVisitRemark("客戶來電", "虛構原因", true);
  assert.equal(stored, "客戶來電\n原因：虛構原因");
  const editable = splitVisitRemark(stored, true);
  assert.deepEqual(editable, { remark: "客戶來電", reasonDetail: "虛構原因" });
  assert.equal(joinVisitRemark(editable.remark, editable.reasonDetail, true), stored);
  assert.equal(joinVisitRemark(editable.remark, editable.reasonDetail, false), "客戶來電");
});
