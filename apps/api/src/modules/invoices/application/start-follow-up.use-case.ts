import { Inject, Injectable, Logger } from "@nestjs/common";
import { firstSendAt } from "@nudge/shared";
import {
  START_FOLLOW_UP_REPOSITORY,
  type StartFollowUpRepository,
} from "../domain/start-follow-up.repository";
import {
  InvoiceNotFoundError,
  InvoiceNotChaseableError,
  NoActiveSequenceError,
  NoStepsError,
} from "../domain/invoice.errors";

const CHASEABLE_STATUSES = ["open", "overdue", "partial"];

export interface StartFollowUpResult {
  runId: string | null;
  created: boolean;
  status: "active" | "already_running";
}

@Injectable()
export class StartFollowUpUseCase {
  private readonly logger = new Logger(StartFollowUpUseCase.name);

  constructor(
    @Inject(START_FOLLOW_UP_REPOSITORY)
    private readonly repo: StartFollowUpRepository,
  ) {}

  async execute(invoiceId: string, businessId: string): Promise<StartFollowUpResult> {
    const ctx = await this.repo.getFollowUpContext(invoiceId, businessId);
    if (!ctx) throw new InvoiceNotFoundError(invoiceId);

    if (!CHASEABLE_STATUSES.includes(ctx.status)) {
      throw new InvoiceNotChaseableError(invoiceId, ctx.status);
    }

    const sequenceId = await this.resolveSequenceId(invoiceId, businessId, ctx);

    const firstStep = await this.repo.findSequenceFirstStep(sequenceId);
    if (!firstStep) throw new NoStepsError(sequenceId);

    const nextSendAt = firstSendAt(
      ctx.dueDate,
      firstStep.firstStepDelayDays,
      ctx.businessTimezone,
    );

    const { created, runId } = await this.repo.createSequenceRun({
      invoiceId,
      businessId,
      sequenceId,
      currentStepId: firstStep.firstStepId,
      status: "active",
      nextSendAt,
      startedAt: new Date(),
    });

    if (created) {
      this.logger.log({
        msg: `follow-up started for invoice ${invoiceId}`,
        event: "follow_up_started",
        invoiceId,
        businessId,
        sequenceId,
        runId,
      });
      return { runId, created: true, status: "active" };
    }

    return { runId: null, created: false, status: "already_running" };
  }

  // Mirrors the worker's resolution order: active customer override → customer
  // tier sequence (error if wired-but-inactive) → business default tier sequence.
  private async resolveSequenceId(
    invoiceId: string,
    businessId: string,
    ctx: {
      customerSequenceId: string | null;
      customerSequenceIsActive: boolean | null;
      customerTierSequenceId: string | null;
      customerTierSequenceIsActive: boolean | null;
    },
  ): Promise<string> {
    if (ctx.customerSequenceId !== null && ctx.customerSequenceIsActive === true) {
      return ctx.customerSequenceId;
    }
    if (ctx.customerTierSequenceId !== null) {
      if (ctx.customerTierSequenceIsActive === true) return ctx.customerTierSequenceId;
      throw new NoActiveSequenceError(invoiceId);
    }
    const fallback = await this.repo.findDefaultTierSequenceId(businessId);
    if (!fallback) throw new NoActiveSequenceError(invoiceId);
    return fallback;
  }
}
