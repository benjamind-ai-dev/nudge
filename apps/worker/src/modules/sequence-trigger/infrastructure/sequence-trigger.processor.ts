import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, type SequenceTriggerJobData } from "@nudge/shared";
import { TriggerSequencesUseCase } from "../application/trigger-sequences.use-case";

@Processor(QUEUE_NAMES.SEQUENCE_TRIGGER)
export class SequenceTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(SequenceTriggerProcessor.name);

  constructor(private readonly triggerSequences: TriggerSequencesUseCase) {
    super();
  }

  async process(job: Job<SequenceTriggerJobData>): Promise<void> {
    if (job.name === "sequence-trigger-tick") {
      this.logger.log({
        msg: "Sequence trigger tick started",
        event: "sequence_trigger_tick_started",
        jobId: job.id,
      });

      const result = await this.triggerSequences.execute();

      this.logger.log({
        msg: "Sequence trigger tick completed",
        event: "sequence_trigger_tick_completed",
        jobId: job.id,
        runsCreated: result.runsCreated,
        invoicesProcessed: result.invoicesProcessed,
        skippedCount: result.skipped.length,
      });
    }
  }
}
