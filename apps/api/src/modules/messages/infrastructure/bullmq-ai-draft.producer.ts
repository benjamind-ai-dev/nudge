import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES, type AiDraftJobData } from "@nudge/shared";

@Injectable()
export class BullmqAiDraftProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.AI_DRAFT) private readonly queue: Queue,
  ) {}

  async enqueue(messageId: string, businessId: string): Promise<void> {
    const data: AiDraftJobData = { messageId, businessId };
    await this.queue.add(JOB_NAMES.GENERATE_AI_DRAFT, data, {
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: false,
      backoff: { type: "exponential", delay: 5_000 },
    });
  }
}
