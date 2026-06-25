import { Inject, Injectable } from "@nestjs/common";
import { firstSendAt } from "@nudge/shared";
import { ENROLLMENT_REPOSITORY, type EnrollmentRepository, type EnrollOutcome } from "../domain/enrollment.repository";
import { SequenceNotFoundError, SequenceNotActiveError, SequenceHasNoStepsError } from "../domain/sequence.errors";

const CHASEABLE_STATUSES = ["open", "overdue", "partial"];

export interface EnrollResultItem { invoiceId: string; outcome: EnrollOutcome; runId: string | null; }
export interface EnrollResult { enrolled: number; moved: number; skipped: number; items: EnrollResultItem[]; }

@Injectable()
export class EnrollInvoicesUseCase {
  constructor(@Inject(ENROLLMENT_REPOSITORY) private readonly repo: EnrollmentRepository) {}

  async execute(sequenceId: string, businessId: string, invoiceIds: string[]): Promise<EnrollResult> {
    const target = await this.repo.findEnrollTarget(sequenceId, businessId);
    if (!target) throw new SequenceNotFoundError(sequenceId);
    if (!target.isActive) throw new SequenceNotActiveError(sequenceId);
    if (!target.firstStepId) throw new SequenceHasNoStepsError(sequenceId);

    const items: EnrollResultItem[] = [];
    for (const invoiceId of invoiceIds) {
      const ctx = await this.repo.getInvoiceContext(invoiceId, businessId);
      if (!ctx) { items.push({ invoiceId, outcome: "skipped_not_found", runId: null }); continue; }
      if (!CHASEABLE_STATUSES.includes(ctx.status)) {
        items.push({ invoiceId, outcome: "skipped_not_chaseable", runId: null }); continue;
      }
      const nextSendAt = firstSendAt(ctx.dueDate, target.firstStepDelayDays, ctx.businessTimezone);
      const { moved, runId } = await this.repo.moveAndCreateRun({
        invoiceId, businessId, sequenceId, currentStepId: target.firstStepId, nextSendAt,
      });
      items.push({ invoiceId, outcome: moved ? "moved" : "enrolled", runId });
    }

    return {
      enrolled: items.filter((i) => i.outcome === "enrolled").length,
      moved: items.filter((i) => i.outcome === "moved").length,
      skipped: items.filter((i) => i.outcome.startsWith("skipped")).length,
      items,
    };
  }
}
