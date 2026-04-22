import { Inject, Injectable, Logger } from "@nestjs/common";
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  SEQUENCE_TRIGGER_REPOSITORY,
  type OverdueInvoiceRow,
  type SequenceTriggerRepository,
} from "../domain/sequence-trigger.repository";
import { NoActiveSequenceError, NoTierError } from "../domain/sequence-trigger.errors";
import { nextBusinessHour } from "../../../common/utils/business-hours";

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
          if (created) {
            result.runsCreated++;
          }
        } catch (error) {
          if (error instanceof NoActiveSequenceError) {
            this.logger.warn({
              msg: `No active sequence for tier ${error.tierName}, business ${error.businessId}. Invoice ${invoice.invoiceNumber} skipped.`,
              event: "sequence_trigger_no_sequence",
              tierId: error.tierId,
              tierName: error.tierName,
              businessId: error.businessId,
              invoiceId: invoice.invoiceId,
            });
            result.skipped.push({ invoiceId: invoice.invoiceId, reason: "no_active_sequence" });
          } else if (error instanceof NoTierError) {
            this.logger.error({
              msg: `Customer has no tier and no default tier exists`,
              event: "sequence_trigger_no_tier",
              customerId: error.customerId,
              businessId: error.businessId,
              invoiceId: invoice.invoiceId,
            });
            result.skipped.push({ invoiceId: invoice.invoiceId, reason: "no_tier" });
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
    const tierId = await this.resolveTierId(invoice);
    const tierData = await this.repo.findActiveSequenceForTier(tierId);

    if (!tierData) {
      const defaultTier = await this.repo.findDefaultTier(invoice.businessId);
      throw new NoActiveSequenceError(
        tierId,
        defaultTier?.name ?? "Unknown",
        invoice.businessId,
      );
    }

    const nextSendAt = this.calculateNextSendAt(
      invoice.dueDate,
      tierData.firstStepDelayDays,
      invoice.businessTimezone,
    );

    const { created } = await this.repo.createSequenceRun({
      invoiceId: invoice.invoiceId,
      sequenceId: tierData.sequenceId,
      currentStepId: tierData.firstStepId,
      status: "active",
      nextSendAt,
      startedAt: new Date(),
    });

    return created;
  }

  private async resolveTierId(invoice: OverdueInvoiceRow): Promise<string> {
    if (invoice.customerTierId) {
      return invoice.customerTierId;
    }

    const defaultTier = await this.repo.findDefaultTier(invoice.businessId);
    if (!defaultTier) {
      throw new NoTierError(invoice.customerId, invoice.businessId);
    }

    return defaultTier.id;
  }

  private calculateNextSendAt(
    dueDate: Date,
    delayDays: number,
    timezone: string,
  ): Date {
    const zoned = toZonedTime(dueDate, timezone);
    const withDelay = addDays(zoned, delayDays);
    const at9am = setMilliseconds(setSeconds(setMinutes(setHours(withDelay, 9), 0), 0), 0);
    const utc = fromZonedTime(at9am, timezone);

    const now = new Date();
    const scheduledTime = utc < now ? now : utc;

    return nextBusinessHour(scheduledTime, timezone);
  }
}
