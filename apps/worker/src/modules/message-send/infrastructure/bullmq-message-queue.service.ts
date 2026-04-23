import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES, type MessageSendJobData } from "@nudge/shared";
import type { MessageQueueService, EnqueueOptions } from "../domain/message-queue.service";

@Injectable()
export class BullMQMessageQueueService implements MessageQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.MESSAGE_SEND)
    private readonly queue: Queue,
  ) {}

  async enqueueSendMessage(data: MessageSendJobData, options: EnqueueOptions): Promise<void> {
    await this.queue.add(JOB_NAMES.SEND_MESSAGE, data, {
      // Deterministic jobId prevents double-enqueue if a tick fires while the
      // previous batch is still processing. BullMQ ignores duplicate jobIds
      // while the job is active or waiting.
      jobId: `send-${data.sequenceRunId}`,
      attempts: options.attempts,
      backoff: options.backoff,
      // Remove completed jobs immediately so the same jobId can be re-enqueued
      // on subsequent ticks (e.g. after a run advances to its next step).
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
