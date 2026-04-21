import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ProviderName } from "@nudge/connections-domain";
import { InvoiceSyncJobData, QUEUE_NAMES } from "@nudge/shared";
import {
  INVOICE_SYNC_PROVIDERS,
  type InvoiceSyncProviderMap,
} from "../domain/invoice-sync.provider";
import {
  SYNC_CONNECTION_READER,
  type SyncConnectionReader,
} from "../domain/repositories";

const PER_BUSINESS_JOB_NAME = "invoice-sync";

@Injectable()
export class EnqueueBusinessSyncsUseCase {
  private readonly logger = new Logger(EnqueueBusinessSyncsUseCase.name);

  constructor(
    @Inject(SYNC_CONNECTION_READER)
    private readonly reader: SyncConnectionReader,
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly queue: Queue<InvoiceSyncJobData>,
    @Inject(INVOICE_SYNC_PROVIDERS)
    private readonly providers: InvoiceSyncProviderMap,
  ) {}

  async execute(): Promise<void> {
    const registered = Object.keys(this.providers).filter(
      (k) => this.providers[k as ProviderName] !== undefined,
    ) as ProviderName[];

    const connections = await this.reader.findAllSyncable(registered);

    for (const conn of connections) {
      if (!conn.id) continue;
      await this.queue.add(
        PER_BUSINESS_JOB_NAME,
        { businessId: conn.businessId },
        {
          jobId: `sync-${conn.businessId}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    this.logger.log({
      msg: "Invoice sync tick enqueued",
      event: "invoice_sync_tick_enqueued",
      count: connections.length,
    });
  }
}
