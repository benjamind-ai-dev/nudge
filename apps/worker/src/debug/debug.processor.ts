import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { DeadLetterService } from "../common/queue/dead-letter.service";

@Processor(QUEUE_NAMES.INVOICE_SYNC)
export class DebugProcessor extends WorkerHost {
  private readonly logger = new Logger(DebugProcessor.name);

  constructor(private readonly deadLetterService: DeadLetterService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id}: ${JSON.stringify(job.data)}`);
    this.logger.log("Test job processed successfully");
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await this.deadLetterService.moveToDeadLetter(job, error);
    }
  }
}
