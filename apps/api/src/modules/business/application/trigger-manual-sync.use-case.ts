import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  CONNECTION_REPOSITORY,
  type ConnectionRepository,
  type ProviderName,
} from "@nudge/connections-domain";
import { QUEUE_NAMES, type InvoiceSyncJobData } from "@nudge/shared";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
} from "../domain/business.repository";
import {
  BusinessNotFoundError,
  NoActiveConnectionError,
  SyncRateLimitedError,
} from "../domain/business.errors";
import { SyncRateLimitService } from "../infrastructure/sync-rate-limit.service";

export interface TriggerManualSyncOutput {
  message: string;
  jobId: string;
}

// BullMQ: priority 1 is the highest. Manual syncs jump ahead of the
// periodic per-business sync batch emitted by the worker tick.
const PRIORITY_HIGH = 1;

@Injectable()
export class TriggerManualSyncUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businesses: BusinessRepository,
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
    private readonly rateLimit: SyncRateLimitService,
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly invoiceSync: Queue<InvoiceSyncJobData>,
  ) {}

  async execute(
    businessId: string,
    opts: { full?: boolean } = {},
  ): Promise<TriggerManualSyncOutput> {
    const business = await this.businesses.findById(businessId);
    if (!business) {
      throw new BusinessNotFoundError(businessId);
    }

    const connection = await this.connections.findByBusinessAndProvider(
      businessId,
      business.accountingProvider as ProviderName,
    );
    if (!connection || !connection.id || connection.status !== "connected") {
      throw new NoActiveConnectionError(businessId);
    }

    const outcome = await this.rateLimit.tryAcquire(businessId);
    if (!outcome.acquired) {
      throw new SyncRateLimitedError(businessId, outcome.retryAfterSeconds);
    }

    const job = await this.invoiceSync.add(
      QUEUE_NAMES.INVOICE_SYNC,
      {
        connectionId: connection.id,
        ...(opts.full ? { full: true } : {}),
      },
      { priority: PRIORITY_HIGH },
    );
    if (!job.id) {
      throw new Error("BullMQ returned a job without an id");
    }

    return {
      message: opts.full ? "Full resync queued" : "Sync queued",
      jobId: job.id,
    };
  }
}
