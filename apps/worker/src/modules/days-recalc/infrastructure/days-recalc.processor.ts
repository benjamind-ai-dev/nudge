import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@nudge/shared";
import { ReconcileTotalOutstandingUseCase } from "../../invoice-sync/application/reconcile-total-outstanding.use-case";
import { RecalculateDaysOverdueUseCase } from "../application/recalculate-days-overdue.use-case";

@Processor(QUEUE_NAMES.DAYS_RECALC, { concurrency: 1 })
export class DaysRecalcProcessor extends WorkerHost {
  private readonly logger = new Logger(DaysRecalcProcessor.name);

  constructor(
    private readonly recalculate: RecalculateDaysOverdueUseCase,
    private readonly reconcile: ReconcileTotalOutstandingUseCase,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOB_NAMES.DAYS_RECALC_TICK) {
      this.logger.warn({
        msg: "Unknown days-recalc job name, ignoring",
        event: "days_recalc_unknown_job",
        jobId: job.id,
        jobName: job.name,
      });
      return;
    }

    this.logger.log({
      msg: "Days recalc tick started",
      event: "days_recalc_tick_started",
      jobId: job.id,
    });

    const recalcResult = await this.recalculate.execute();

    this.logger.log({
      msg: "Days recalc step completed",
      event: "days_recalc_step_completed",
      jobId: job.id,
      updatedCount: recalcResult.updatedCount,
      transitionedCount: recalcResult.transitionedCount,
      transitionedWithoutSequenceCount: recalcResult.transitionedWithoutSequenceCount,
    });

    try {
      const reconcileResult = await this.reconcile.execute();
      this.logger.log({
        msg: "Reconcile step completed",
        event: "reconcile_step_completed",
        jobId: job.id,
        reconciledCount: reconcileResult.updatedCount,
      });
    } catch (err) {
      this.logger.error({
        msg: "Reconcile step failed (non-fatal)",
        event: "reconcile_step_failed",
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.log({
      msg: "Days recalc tick completed",
      event: "days_recalc_tick_completed",
      jobId: job.id,
      updatedCount: recalcResult.updatedCount,
      transitionedCount: recalcResult.transitionedCount,
      transitionedWithoutSequenceCount: recalcResult.transitionedWithoutSequenceCount,
    });
  }
}
