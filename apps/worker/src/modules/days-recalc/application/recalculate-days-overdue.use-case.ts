import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DAYS_RECALC_REPOSITORY,
  type DaysRecalcRepository,
} from "../domain/days-recalc.repository";

const LOG_SAMPLE_LIMIT = 10;

export interface RecalcResult {
  updatedCount: number;
  transitionedCount: number;
  transitionedWithoutSequenceCount: number;
}

@Injectable()
export class RecalculateDaysOverdueUseCase {
  private readonly logger = new Logger(RecalculateDaysOverdueUseCase.name);

  constructor(
    @Inject(DAYS_RECALC_REPOSITORY)
    private readonly repo: DaysRecalcRepository,
  ) {}

  async execute(): Promise<RecalcResult> {
    const { updatedCount, transitioned } = await this.repo.recalculate();

    let transitionedWithoutSequenceCount = 0;
    if (transitioned.length > 0) {
      const without = await this.repo.findInvoicesWithoutActiveSequenceRun(
        transitioned.map((t) => t.invoiceId),
      );
      transitionedWithoutSequenceCount = without.length;

      if (without.length > 0) {
        this.logger.log({
          msg: `${without.length} invoices transitioned to overdue but have no active sequence. Next sequence-trigger run will pick them up.`,
          event: "days_recalc_transitioned_without_sequence",
          count: without.length,
          sampleInvoiceNumbers: without
            .slice(0, LOG_SAMPLE_LIMIT)
            .map((i) => i.invoiceNumber)
            .filter((n): n is string => Boolean(n)),
        });
      }
    }

    this.logger.log({
      msg: `Days overdue recalculated for ${updatedCount} invoices. ${transitioned.length} invoices transitioned from open to overdue.`,
      event: "days_recalc_completed",
      updatedCount,
      transitionedCount: transitioned.length,
      transitionedWithoutSequenceCount,
    });

    return {
      updatedCount,
      transitionedCount: transitioned.length,
      transitionedWithoutSequenceCount,
    };
  }
}
