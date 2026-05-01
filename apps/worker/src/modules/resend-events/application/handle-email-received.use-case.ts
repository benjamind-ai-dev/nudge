import { Inject, Injectable, Logger } from "@nestjs/common";
import { STOPPED_REASONS } from "@nudge/shared";
import {
  type ResendEventsCustomerRepository,
  RESEND_EVENTS_CUSTOMER_REPOSITORY,
} from "../domain/resend-events-customer.repository";
import {
  type ResendEventsSequenceRunRepository,
  RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY,
} from "../domain/resend-events-sequence-run.repository";

export interface HandleEmailReceivedInput {
  fromEmail: string;
}

@Injectable()
export class HandleEmailReceivedUseCase {
  private readonly logger = new Logger(HandleEmailReceivedUseCase.name);

  constructor(
    @Inject(RESEND_EVENTS_CUSTOMER_REPOSITORY)
    private readonly customerRepo: ResendEventsCustomerRepository,
    @Inject(RESEND_EVENTS_SEQUENCE_RUN_REPOSITORY)
    private readonly runRepo: ResendEventsSequenceRunRepository,
  ) {}

  async execute(input: HandleEmailReceivedInput): Promise<void> {
    const runs = await this.customerRepo.findActiveRunsByContactEmail(input.fromEmail);

    if (runs.length === 0) {
      this.logger.warn({
        msg: "No active runs found for reply sender — skipping",
        fromEmail: input.fromEmail,
      });
      return;
    }

    for (const run of runs) {
      await this.runRepo.stopRun(run.runId, run.businessId, STOPPED_REASONS.CLIENT_REPLIED);
    }

    this.logger.log({
      msg: "Sequence runs stopped due to customer reply",
      fromEmail: input.fromEmail,
      stoppedCount: runs.length,
    });
  }
}
