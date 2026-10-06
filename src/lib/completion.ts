import { z } from "zod";

export const completionSnapshotSchema = z.object({
  previousVisitStatus: z.enum(["已預約", "未完成", "已取消"]).nullable(),
  beforeInstallationStatus: z.string().nullable(),
  beforeServiceStatus: z.string().nullable(),
  afterInstallationStatus: z.string().nullable(),
  afterServiceStatus: z.string().nullable(),
  completedAt: z.iso.datetime(),
});

export type CompletionSnapshot = z.infer<typeof completionSnapshotSchema>;

export function assertCompletionCanBeReversed(
  snapshot: CompletionSnapshot,
  current: { installationStatus: string | null; serviceStatus: string | null },
  hasNewerCaseStatusChange: boolean,
) {
  if (hasNewerCaseStatusChange || current.installationStatus !== snapshot.afterInstallationStatus || current.serviceStatus !== snapshot.afterServiceStatus) {
    throw new Error("個案狀態之後已有其他變更；請由管理員檢查，不能自動回復");
  }
}
