import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES, RefreshConnectionJobData } from "@nudge/shared";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";
import { EnqueueRefreshJobsUseCase } from "../application/enqueue-refresh-jobs.use-case";
import { RefreshTokenUseCase } from "../application/refresh-token.use-case";

const MAX_ERROR_MESSAGE_LENGTH = 500;

type TokenRefreshJob =
  | Job<undefined>
  | Job<RefreshConnectionJobData>;

@Processor(QUEUE_NAMES.TOKEN_REFRESH)
@Injectable()
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(
    private readonly tickUseCase: EnqueueRefreshJobsUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
  ) {
    super();
  }

  async process(job: TokenRefreshJob): Promise<void> {
    if (job.name === "token-refresh-tick") {
      await this.tickUseCase.execute();
      return;
    }
    if (job.name === "refresh-connection") {
      const { connectionId } = job.data as RefreshConnectionJobData;
      await this.refreshUseCase.execute(connectionId);
      return;
    }
    this.logger.warn({
      msg: "Unknown token-refresh job name",
      event: "refresh_unknown_job",
      jobName: job.name,
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(job: TokenRefreshJob, error: Error): Promise<void> {
    if (error instanceof UnrecoverableError) return;

    const maxAttempts = job.opts?.attempts ?? 5;
    if (job.attemptsMade < maxAttempts) return;

    const connectionId = (job.data as RefreshConnectionJobData | undefined)?.connectionId;
    if (!connectionId) return;

    const truncated =
      error.message.length > MAX_ERROR_MESSAGE_LENGTH
        ? error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH)
        : error.message;

    await this.connections.updateStatus(connectionId, "error", truncated);
    this.logger.error({
      msg: "Token refresh exhausted retries",
      event: "refresh_exhausted",
      connectionId,
      attemptNumber: job.attemptsMade,
      errorType: error.name,
      errorMessage: truncated,
    });
  }
}
