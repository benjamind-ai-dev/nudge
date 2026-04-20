import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, RefreshConnectionJobData } from "@nudge/shared";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";

const BUFFER_MS = 15 * 60_000;

@Injectable()
export class EnqueueRefreshJobsUseCase {
  private readonly logger = new Logger(EnqueueRefreshJobsUseCase.name);

  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
    @InjectQueue(QUEUE_NAMES.TOKEN_REFRESH)
    private readonly queue: Queue<RefreshConnectionJobData>,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(Date.now() + BUFFER_MS);
    const due = await this.connections.findDueForRefresh(cutoff);

    for (const conn of due) {
      if (!conn.id) continue;
      await this.queue.add(
        "refresh-connection",
        { connectionId: conn.id, businessId: conn.businessId },
        {
          jobId: `refresh-${conn.id}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    this.logger.log({
      msg: "Refresh tick enqueued",
      event: "refresh_tick_enqueued",
      count: due.length,
    });
  }
}
