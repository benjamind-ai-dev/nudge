import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, SmsSendJobData } from "@nudge/shared";
import { TwilioService } from "./twilio.service";
import { DeadLetterService } from "../../common/queue/dead-letter.service";

@Processor(QUEUE_NAMES.SMS_SEND)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<SmsSendJobData>): Promise<void> {
    this.logger.log(
      `Processing SMS job ${job.id} — to: ${job.data.to}, businessId: ${job.data.businessId}`,
    );

    await this.twilioService.sendSms(job.data);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<SmsSendJobData>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await this.deadLetterService.moveToDeadLetter(job, error);
    }
  }
}
