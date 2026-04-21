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
        { connectionId: conn.id },
        {
          jobId: `sync-${conn.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          // Must be `true` (not a retention count). BullMQ's jobId dedupe
          // applies to completed jobs too — if we retain the record, the
          // next tick silently no-ops. Release the ID on success so future
          // ticks can re-enqueue.
          removeOnComplete: true,
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
