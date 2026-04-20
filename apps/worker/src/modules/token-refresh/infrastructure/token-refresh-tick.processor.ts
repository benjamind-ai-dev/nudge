import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { EnqueueRefreshJobsUseCase } from "../application/enqueue-refresh-jobs.use-case";

@Processor(QUEUE_NAMES.TOKEN_REFRESH)
@Injectable()
export class TokenRefreshTickProcessor extends WorkerHost {
  constructor(private readonly useCase: EnqueueRefreshJobsUseCase) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "token-refresh-tick") return;
    await this.useCase.execute();
  }
}
