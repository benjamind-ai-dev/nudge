import { createHash } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { QUEUE_NAMES, type ResendEventsJobData } from "@nudge/shared";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import { DuplicateResendBatchError } from "../domain/resend-webhook.errors";

const IDEMPOTENCY_TTL_SECONDS = 86_400;
const RESEND_EVENTS_JOB_NAME = "process-resend-events";

export interface IngestResendEventsInput {
  events: unknown[];
  rawBody: Buffer;
}

@Injectable()
export class IngestResendEventsUseCase {
  private readonly logger = new Logger(IngestResendEventsUseCase.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(QUEUE_NAMES.RESEND_EVENTS)
    private readonly queue: Queue<ResendEventsJobData>,
  ) {}

  async execute(input: IngestResendEventsInput): Promise<void> {
    const hash = createHash("sha256").update(input.rawBody).digest("hex");
    const idempotencyKey = `resend:batch:${hash}`;

    const isNew = await this.redis.set(
      idempotencyKey,
      "1",
      "EX",
      IDEMPOTENCY_TTL_SECONDS,
      "NX",
    );

    if (!isNew) {
      this.logger.log({
        msg: "Resend batch already processed, skipping",
        event: "resend_webhook_duplicate",
        idempotencyKey,
      });
      throw new DuplicateResendBatchError(idempotencyKey);
    }

    await this.queue.add(RESEND_EVENTS_JOB_NAME, { payload: input.events }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log({
      msg: "Resend events batch enqueued",
      event: "resend_webhook_enqueued",
      eventCount: input.events.length,
    });
  }
}
