import { Injectable } from "@nestjs/common";
import type { StoppedReason } from "@nudge/shared";
import type { PrismaTransactionClient } from "../../../common/database/prisma-tx";
import type { SequenceRunRepository } from "../domain/repositories";

@Injectable()
export class PrismaSequenceRunRepository implements SequenceRunRepository {
  /**
   * Stops every active|paused sequence_run for an invoice. Two queries inside
   * the caller's transaction:
   * 1. findMany to capture the IDs (so the caller can log them).
   * 2. updateMany to flip status/stoppedReason/completedAt atomically.
   *
   * The partial index `idx_runs_invoice` on `(invoiceId, status)` keeps the
   * findMany cheap. Returns [] when no runs are active or paused.
   */
  async stopActiveRunsForInvoice(
    tx: PrismaTransactionClient,
    invoiceId: string,
    reason: StoppedReason,
    completedAt: Date,
  ): Promise<string[]> {
    const runs = await tx.sequenceRun.findMany({
      where: { invoiceId, status: { in: ["active", "paused"] } },
      select: { id: true },
    });
    if (runs.length === 0) return [];

    const ids = runs.map((r) => r.id);
    await tx.sequenceRun.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "stopped",
        stoppedReason: reason,
        completedAt,
      },
    });
    return ids;
  }
}
