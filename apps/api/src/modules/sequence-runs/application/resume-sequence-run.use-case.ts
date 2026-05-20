import { Inject, Injectable, Logger } from "@nestjs/common";
import { addHours } from "date-fns";
import { nextBusinessHour } from "@nudge/shared";
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
export class ResumeSequenceRunUseCase {
  private readonly logger = new Logger(ResumeSequenceRunUseCase.name);

  constructor(
    @Inject(SEQUENCE_RUN_REPOSITORY)
    private readonly repo: SequenceRunRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<SequenceRunDetail> {
    const ctx = await this.repo.findActionContext(id, businessId);
    if (!ctx) throw new SequenceRunNotFoundError(id);
    if (ctx.status !== "paused") {
      throw new InvalidStatusTransitionError(id, ctx.status, "resume");
    }

    // v1 product decision (ticket "simplest approach"): resume at now + 1h,
    // adjusted to the next business hour in the business's timezone.
    const target = addHours(new Date(), 1);
    const nextSendAt = nextBusinessHour(target, ctx.invoice.businessTimezone);

    await this.repo.resume(id, businessId, nextSendAt);

    this.logger.log({
      msg: `resume sequence run ${id} for invoice ${ctx.invoice.invoiceNumber}, customer ${ctx.customer.companyName}. Reason: manual_resume`,
      event: "sequence_run_resumed",
      sequenceRunId: id,
      businessId,
      nextSendAt: nextSendAt.toISOString(),
    });

    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new SequenceRunNotFoundError(id);
    return detail;
  }
}
