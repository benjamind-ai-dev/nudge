import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetterQueue: Queue,
  ) {}

  async moveToDeadLetter(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Job ${job.id} on ${job.queueName} failed permanently after ${job.attemptsMade} attempts: ${error.message}`,
    );

    await this.deadLetterQueue.add("dead-letter", {
      originalQueue: job.queueName,
      originalJobId: job.id,
      data: job.data,
      failedReason: error.message,
      failedAt: new Date().toISOString(),
    });
  }
}
