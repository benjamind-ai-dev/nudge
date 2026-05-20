import { Inject, Injectable, Logger } from "@nestjs/common";
import { PAUSED_REASONS } from "@nudge/shared";
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
export class PauseSequenceRunUseCase {
  private readonly logger = new Logger(PauseSequenceRunUseCase.name);

  constructor(
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly repo: SequenceRunRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<SequenceRunDetail> {
    const ctx = await this.repo.findActionContext(id, businessId);
    if (!ctx) throw new SequenceRunNotFoundError(id);
    if (ctx.status !== "active") {
      throw new InvalidStatusTransitionError(id, ctx.status, "pause");
    }

    // API surface accepts the literal "manual_pause"; we persist the shared
    // constant value (which is also "manual_pause" — see PAUSED_REASONS.MANUAL_PAUSE).
    const reason = PAUSED_REASONS.MANUAL_PAUSE;
    await this.repo.pause(id, businessId, reason);

    this.logger.log({
      msg: `pause sequence run ${id} for invoice ${ctx.invoice.invoiceNumber}, customer ${ctx.customer.companyName}. Reason: ${reason}`,
      event: "sequence_run_paused",
      sequenceRunId: id,
      businessId,
      reason,
    });

    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new SequenceRunNotFoundError(id);
    return detail;
  }
}
