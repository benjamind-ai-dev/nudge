import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@nudge/shared";
import { CheckDeadLetterUseCase } from "../application/check-dead-letter.use-case";

@Processor(QUEUE_NAMES.DEAD_LETTER_CHECK, {
  concurrency: 1,
})
export class DeadLetterMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadLetterMonitorProcessor.name);

  constructor(private readonly checkDeadLetter: CheckDeadLetterUseCase) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOB_NAMES.DEAD_LETTER_CHECK_TICK) {
      this.logger.warn({
        msg: "Unknown job name received, ignoring",
        event: "unknown_job_name",
        jobId: job.id,
        jobName: job.name,
      });
      return;
    }

    this.logger.log({
      msg: "Dead letter check tick started",
      event: "dead_letter_check_tick_started",
      jobId: job.id,
    });

    const result = await this.checkDeadLetter.execute();

    this.logger.log({
      msg: "Dead letter check tick completed",
      event: "dead_letter_check_tick_completed",
      jobId: job.id,
      deadJobCount: result.deadJobCount,
      stuckJobCount: result.stuckJobCount,
      alertSent: result.alertSent,
    });
  }
}
