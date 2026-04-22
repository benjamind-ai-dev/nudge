import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { EnqueueReadyRunsUseCase } from "../application/enqueue-ready-runs.use-case";
import { SendMessageUseCase } from "../application/send-message.use-case";

interface SendMessageJobData {
  runId: string;
}

@Processor(QUEUE_NAMES.MESSAGE_SEND, {
  concurrency: 10,
})
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly enqueueReadyRuns: EnqueueReadyRunsUseCase,
    private readonly sendMessage: SendMessageUseCase,
  ) {
    super();
  }

  async process(job: Job<SendMessageJobData | Record<string, never>>): Promise<void> {
    if (job.name === "message-send-tick") {
      await this.handleTick(job);
    } else if (job.name === "send-message") {
      await this.handleSendMessage(job as Job<SendMessageJobData>);
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

  private async handleSendMessage(job: Job<SendMessageJobData>): Promise<void> {
    this.logger.debug({
      msg: "Processing send-message job",
      event: "send_message_job_started",
      jobId: job.id,
      runId: job.data.runId,
      attempt: job.attemptsMade + 1,
    });

    const result = await this.sendMessage.execute({ runId: job.data.runId });

    this.logger.debug({
      msg: "Send-message job completed",
      event: "send_message_job_completed",
      jobId: job.id,
      runId: job.data.runId,
      sent: result.sent,
      skippedReason: result.skippedReason,
      messagesSent: result.messagesSent,
    });
  }
}
