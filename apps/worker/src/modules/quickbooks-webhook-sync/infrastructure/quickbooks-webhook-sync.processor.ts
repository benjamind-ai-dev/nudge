import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type QuickbooksWebhooksJobData } from "@nudge/shared";
import { SyncSingleInvoiceUseCase } from "../../invoice-sync/application/sync-single-invoice.use-case";

const SYNC_SINGLE_INVOICE_JOB = "sync-single-invoice";

@Processor(QUEUE_NAMES.QUICKBOOKS_WEBHOOKS, { concurrency: 5 })
@Injectable()
export class QuickbooksWebhookSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(QuickbooksWebhookSyncProcessor.name);

  constructor(private readonly syncSingleInvoice: SyncSingleInvoiceUseCase) {
    super();
  }

  async process(job: Job<QuickbooksWebhooksJobData>): Promise<void> {
    if (job.name === SYNC_SINGLE_INVOICE_JOB) {
      await this.syncSingleInvoice.execute(job.data);
      return;
    }
    this.logger.warn({
      msg: "Unknown quickbooks-webhooks job name",
      event: "qb_webhooks_unknown_job",
      jobName: job.name,
    });
  }
}
