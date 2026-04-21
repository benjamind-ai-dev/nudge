import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { InvoiceSyncJobData, QUEUE_NAMES } from "@nudge/shared";
import { EnqueueBusinessSyncsUseCase } from "../application/enqueue-business-syncs.use-case";
import { SyncBusinessInvoicesUseCase } from "../application/sync-business-invoices.use-case";

const TICK_JOB_NAME = "invoice-sync-tick";
const PER_BUSINESS_JOB_NAME = "invoice-sync";

type InvoiceSyncJob = Job<undefined> | Job<InvoiceSyncJobData>;

@Processor(QUEUE_NAMES.INVOICE_SYNC, { concurrency: 5 })
@Injectable()
export class InvoiceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceSyncProcessor.name);

  constructor(
    private readonly tick: EnqueueBusinessSyncsUseCase,
    private readonly sync: SyncBusinessInvoicesUseCase,
  ) {
    super();
  }

  async process(job: InvoiceSyncJob): Promise<void> {
    if (job.name === TICK_JOB_NAME) {
      await this.tick.execute();
      return;
    }
    if (job.name === PER_BUSINESS_JOB_NAME) {
      const { businessId } = job.data as InvoiceSyncJobData;
      await this.sync.execute(businessId);
      return;
    }
    this.logger.warn({
      msg: "Unknown invoice-sync job name",
      event: "invoice_sync_unknown_job",
      jobName: job.name,
    });
  }
}
