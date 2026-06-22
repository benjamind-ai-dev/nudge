import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  SEQUENCE_TRIGGER_REPOSITORY,
  type OverdueInvoiceRow,
  type SequenceTriggerRepository,
} from "../domain/sequence-trigger.repository";
import { NoActiveSequenceError, NoStepsError } from "../domain/sequence-trigger.errors";
import { firstSendAt } from "@nudge/shared";

const BATCH_SIZE = 100;

export interface TriggerResult {
  invoicesProcessed: number;
  runsCreated: number;
  skipped: Array<{ invoiceId: string; reason: string }>;
}

@Injectable()
export class TriggerSequencesUseCase {
  private readonly logger = new Logger(TriggerSequencesUseCase.name);

  constructor(
    @Inject(SEQUENCE_TRIGGER_REPOSITORY)
    private readonly repo: SequenceTriggerRepository,
  ) {}

  async execute(): Promise<TriggerResult> {
    const result: TriggerResult = {
      invoicesProcessed: 0,
      runsCreated: 0,
      skipped: [],
    };

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const invoices = await this.repo.findOverdueInvoicesWithoutRun(BATCH_SIZE, offset);
      hasMore = invoices.length === BATCH_SIZE;
      offset += invoices.length;

      for (const invoice of invoices) {
        result.invoicesProcessed++;
        try {
          const created = await this.processInvoice(invoice);
          if (created) result.runsCreated++;
        } catch (error) {
          if (error instanceof NoActiveSequenceError) {
            this.logger.warn({
              msg: `No sequence configured for customer ${error.customerId}. Invoice ${invoice.invoiceNumber} skipped.`,
              event: "sequence_trigger_no_sequence",
              customerId: error.customerId,
              businessId: error.businessId,
              invoiceId: invoice.invoiceId,
            });
            result.skipped.push({ invoiceId: invoice.invoiceId, reason: "no_active_sequence" });
          } else if (error instanceof NoStepsError) {
            this.logger.warn({
              msg: `Sequence ${error.sequenceId} has no steps. Invoice ${invoice.invoiceNumber} skipped.`,
              event: "sequence_trigger_no_steps",
              sequenceId: error.sequenceId,
              invoiceId: invoice.invoiceId,
            });
            result.skipped.push({ invoiceId: invoice.invoiceId, reason: "no_steps" });
          } else {
            throw error;
          }
        }
      }
    }

    this.logger.log({
      msg: "Sequence trigger completed",
      event: "sequence_trigger_completed",
      invoicesProcessed: result.invoicesProcessed,
      runsCreated: result.runsCreated,
      skippedCount: result.skipped.length,
    });

    return result;
  }

  private async processInvoice(invoice: OverdueInvoiceRow): Promise<boolean> {
    let sequenceId: string | null = null;

    if (invoice.customerSequenceId !== null && invoice.customerSequenceIsActive === true) {
      sequenceId = invoice.customerSequenceId;
    }

    // Tier sequence: if the customer's tier HAS a sequence wired but it's paused,
    // stop here. Don't silently demote the customer to the business default.
    if (sequenceId === null && invoice.customerTierSequenceId !== null) {
      if (invoice.customerTierSequenceIsActive === true) {
        sequenceId = invoice.customerTierSequenceId;
      } else {
        throw new NoActiveSequenceError(invoice.customerId, invoice.businessId);
      }
    }

    if (sequenceId === null) {
      sequenceId = await this.repo.findDefaultTierSequenceId(invoice.businessId);
    }

    if (!sequenceId) {
      throw new NoActiveSequenceError(invoice.customerId, invoice.businessId);
    }

    const firstStep = await this.repo.findSequenceFirstStep(sequenceId);
    if (!firstStep) {
      throw new NoStepsError(sequenceId);
    }

    const nextSendAt = firstSendAt(
      invoice.dueDate,
      firstStep.firstStepDelayDays,
      invoice.businessTimezone,
    );

    const { created } = await this.repo.createSequenceRun({
      invoiceId: invoice.invoiceId,
      businessId: invoice.businessId,
      sequenceId,
      currentStepId: firstStep.firstStepId,
      status: "active",
      nextSendAt,
      startedAt: new Date(),
    });

    return created;
  }
}
