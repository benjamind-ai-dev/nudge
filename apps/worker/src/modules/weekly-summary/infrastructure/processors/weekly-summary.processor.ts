import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "@nudge/shared";
import { DispatchWeeklySummariesUseCase } from "../../application/dispatch-weekly-summaries.use-case";
import { GenerateWeeklySummaryUseCase } from "../../application/generate-weekly-summary.use-case";

@Processor(QUEUE_NAMES.WEEKLY_SUMMARY, { concurrency: 5 })
export class WeeklySummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(WeeklySummaryProcessor.name);

  constructor(
    private readonly dispatch: DispatchWeeklySummariesUseCase,
    private readonly generate: GenerateWeeklySummaryUseCase,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB_NAMES.WEEKLY_SUMMARY_DISPATCH) {
      await this.dispatch.execute();
      return;
    }
    if (job.name === JOB_NAMES.WEEKLY_SUMMARY_BUSINESS) {
      const data = job.data as { businessId: string; weekStartsAt: string };
      await this.generate.execute(data);
      return;
    }
    this.logger.warn({ msg: "Unknown weekly-summary job", jobName: job.name, jobId: job.id });
  }
}
