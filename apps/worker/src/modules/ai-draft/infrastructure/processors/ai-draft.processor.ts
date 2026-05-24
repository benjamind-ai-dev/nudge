import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, type AiDraftJobData } from "@nudge/shared";
import { GenerateAiDraftUseCase } from "../../application/generate-ai-draft.use-case";
import { DeadLetterService } from "../../../../common/queue/dead-letter.service";

@Processor(QUEUE_NAMES.AI_DRAFT, { concurrency: 3 })
export class AiDraftProcessor extends WorkerHost {
  private readonly logger = new Logger(AiDraftProcessor.name);

  constructor(
    private readonly useCase: GenerateAiDraftUseCase,
    private readonly deadLetterService: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<AiDraftJobData>): Promise<void> {
    const result = await this.useCase.execute({
      messageId: job.data.messageId,
      businessId: job.data.businessId,
    });

    this.logger.log({
      msg: `AI draft generated for message ${job.data.messageId} in ${result.durationMs}ms`,
      event: result.generated ? "ai_draft_generated" : "ai_draft_skipped",
      jobId: job.id,
      messageId: job.data.messageId,
      businessId: job.data.businessId,
      durationMs: result.durationMs,
      skipReason: result.skipReason,
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await this.deadLetterService.moveToDeadLetter(job, error);
    }
  }
}
