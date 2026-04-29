import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { QUEUE_NAMES, type StripeEventsJobData } from "@nudge/shared";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import { DuplicateStripeEventError } from "../domain/stripe-webhook.errors";

const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours
const STRIPE_EVENT_JOB_NAME = "process-stripe-event";

export interface IngestStripeEventInput {
  eventId: string;
  eventType: string;
  payload: unknown;
}

@Injectable()
export class IngestStripeEventUseCase {
  private readonly logger = new Logger(IngestStripeEventUseCase.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(QUEUE_NAMES.STRIPE_EVENTS)
    private readonly queue: Queue<StripeEventsJobData>,
  ) {}

  async execute(input: IngestStripeEventInput): Promise<void> {
    const idempotencyKey = `stripe:event:${input.eventId}`;
    const isNew = await this.redis.set(
      idempotencyKey,
      "1",
      "EX",
      IDEMPOTENCY_TTL_SECONDS,
      "NX",
    );

    if (!isNew) {
      this.logger.log({
        msg: "Stripe event already processed, skipping",
        event: "stripe_webhook_duplicate",
        eventId: input.eventId,
        eventType: input.eventType,
      });
      throw new DuplicateStripeEventError(input.eventId);
    }

    const jobId = `stripe-${input.eventId}`;
    const data: StripeEventsJobData = {
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
    };

    await this.queue.add(STRIPE_EVENT_JOB_NAME, data, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log({
      msg: "Stripe event enqueued",
      event: "stripe_webhook_enqueued",
      eventId: input.eventId,
      eventType: input.eventType,
    });
  }
}
