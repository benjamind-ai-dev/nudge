import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type XeroWebhooksJobData } from "@nudge/shared";
import { SyncSingleXeroInvoiceUseCase } from "../application/sync-single-xero-invoice.use-case";

const SYNC_SINGLE_INVOICE_JOB = "sync-single-invoice";

@Processor(QUEUE_NAMES.XERO_WEBHOOKS, { concurrency: 5 })
@Injectable()
export class XeroWebhookSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(XeroWebhookSyncProcessor.name);

  constructor(
    private readonly syncSingleInvoice: SyncSingleXeroInvoiceUseCase,
  ) {
    super();
  }

  async process(job: Job<XeroWebhooksJobData>): Promise<void> {
    if (job.name === SYNC_SINGLE_INVOICE_JOB) {
      await this.syncSingleInvoice.execute(job.data);
      return;
    }
    this.logger.warn({
      msg: "Unknown xero-webhooks job name",
      event: "xero_webhooks_unknown_job",
      jobName: job.name,
    });
  }
}
