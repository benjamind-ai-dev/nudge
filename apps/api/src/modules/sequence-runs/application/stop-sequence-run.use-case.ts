import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS } from "@nudge/shared";
import {
  SEQUENCE_RUN_REPOSITORY,
  type SequenceRunRepository,
} from "../domain/sequence-run.repository";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "../domain/sequence-run.errors";

@Injectable()
export class StopSequenceRunUseCase {
  private readonly logger = new Logger(StopSequenceRunUseCase.name);

  constructor(
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly repo: SequenceRunRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<SequenceRunDetail> {
    const ctx = await this.repo.findActionContext(id, businessId);
    if (!ctx) throw new SequenceRunNotFoundError(id);
    if (ctx.status !== "active" && ctx.status !== "paused") {
      throw new InvalidStatusTransitionError(id, ctx.status, "stop");
    }

    const reason = STOPPED_REASONS.MANUALLY_STOPPED;
    const completedAt = new Date();
    await this.repo.stop(id, businessId, reason, completedAt);

    this.logger.log({
      msg: `stop sequence run ${id} for invoice ${ctx.invoice.invoiceNumber}, customer ${ctx.customer.companyName}. Reason: ${reason}`,
      event: "sequence_run_stopped",
      sequenceRunId: id,
      businessId,
      reason,
    });

    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new SequenceRunNotFoundError(id);
    return detail;
  }
}
