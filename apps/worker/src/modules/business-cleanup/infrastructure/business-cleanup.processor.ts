// apps/worker/src/modules/business-cleanup/infrastructure/business-cleanup.processor.ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@nudge/shared";
import type { Env } from "../../../common/config/env.schema";
import { CleanupStaleBusinessesUseCase } from "../application/cleanup-stale-businesses.use-case";

const HOUR_MS = 3_600_000;

@Processor(QUEUE_NAMES.BUSINESS_CLEANUP)
@Injectable()
export class BusinessCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(BusinessCleanupProcessor.name);

  constructor(
    private readonly useCase: CleanupStaleBusinessesUseCase,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOB_NAMES.BUSINESS_CLEANUP_TICK) {
      this.logger.warn({
        msg: "Unknown business-cleanup job name",
        event: "cleanup_unknown_job",
        jobName: job.name,
      });
      return;
    }
    const hours = this.config.get("STALE_BUSINESS_THRESHOLD_HOURS", { infer: true });
    const cutoff = new Date(Date.now() - hours * HOUR_MS);
    await this.useCase.execute(cutoff);
  }
}
