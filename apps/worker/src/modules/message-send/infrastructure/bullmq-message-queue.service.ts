import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, type MessageSendJobData } from "@nudge/shared";
import type { MessageQueueService, EnqueueOptions } from "../domain/message-queue.service";
import { JOB_NAMES } from "../constants";

@Injectable()
export class BullMQMessageQueueService implements MessageQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.MESSAGE_SEND)
    private readonly queue: Queue,
  ) {}

  async enqueueSendMessage(data: MessageSendJobData, options: EnqueueOptions): Promise<void> {
    await this.queue.add(JOB_NAMES.SEND_MESSAGE, data, {
      attempts: options.attempts,
      backoff: options.backoff,
    });
  }
}
