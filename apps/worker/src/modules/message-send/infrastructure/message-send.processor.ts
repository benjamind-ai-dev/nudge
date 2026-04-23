import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES, type MessageSendJobData } from "@nudge/shared";
import { EnqueueReadyRunsUseCase } from "../application/enqueue-ready-runs.use-case";
import { SendMessageUseCase } from "../application/send-message.use-case";
import { DeadLetterService } from "../../../common/queue/dead-letter.service";

@Processor(QUEUE_NAMES.MESSAGE_SEND, {
  concurrency: 10,
  limiter: {
    max: 4,
    duration: 1000,
  },
})
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly enqueueReadyRuns: EnqueueReadyRunsUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<MessageSendJobData | Record<string, never>>): Promise<void> {
    if (job.name === JOB_NAMES.MESSAGE_SEND_TICK) {
      await this.handleTick(job);
    } else if (job.name === JOB_NAMES.SEND_MESSAGE) {
      await this.handleSendMessage(job as Job<MessageSendJobData>);
    } else {
      this.logger.warn({
        msg: "Unknown job name received, ignoring",
        event: "unknown_job_name",
        jobId: job.id,
        jobName: job.name,
      });
    }
  }

  private async handleTick(job: Job): Promise<void> {
    this.logger.log({
      msg: "Message send tick started",
      event: "message_send_tick_started",
      jobId: job.id,
    });

    const result = await this.enqueueReadyRuns.execute();

    this.logger.log({
      msg: "Message send tick completed",
      event: "message_send_tick_completed",
      jobId: job.id,
      runsEnqueued: result.runsEnqueued,
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await this.deadLetterService.moveToDeadLetter(job, error);
    }
  }

  private async handleSendMessage(job: Job<MessageSendJobData>): Promise<void> {
    this.logger.debug({
      msg: "Processing send-message job",
      event: "send_message_job_started",
      jobId: job.id,
      sequenceRunId: job.data.sequenceRunId,
      businessId: job.data.businessId,
      attempt: job.attemptsMade + 1,
    });

    const result = await this.sendMessage.execute({
      sequenceRunId: job.data.sequenceRunId,
      businessId: job.data.businessId,
    });

    this.logger.debug({
      msg: "Send-message job completed",
      event: "send_message_job_completed",
      jobId: job.id,
      sequenceRunId: job.data.sequenceRunId,
      sent: result.sent,
      skippedReason: result.skippedReason,
      messagesSent: result.messagesSent,
    });
  }
}
