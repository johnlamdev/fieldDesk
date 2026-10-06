import test from "node:test";
import assert from "node:assert/strict";
import { assertCompletionCanBeReversed, completionSnapshotSchema } from "../src/lib/completion";

test("completion correction restores only an unchanged case status", () => {
  const snapshot = completionSnapshotSchema.parse({
    previousVisitStatus: "已預約",
    beforeInstallationStatus: "已安排安裝",
    beforeServiceStatus: null,
    afterInstallationStatus: "已完成安裝",
    afterServiceStatus: "服務中",
    completedAt: "2026-10-05T01:00:00.000Z",
  });
  const current = { installationStatus: "已完成安裝", serviceStatus: "服務中" };
  assert.doesNotThrow(() => assertCompletionCanBeReversed(snapshot, current, false));
  assert.throws(() => assertCompletionCanBeReversed(snapshot, current, true), /不能自動回復/);
  assert.throws(() => assertCompletionCanBeReversed(snapshot, { ...current, serviceStatus: "已終止" }, false), /不能自動回復/);
});
