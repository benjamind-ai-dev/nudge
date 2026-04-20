import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES, RefreshConnectionJobData } from "@nudge/shared";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";
import { RefreshTokenUseCase } from "../application/refresh-token.use-case";

const MAX_ERROR_MESSAGE_LENGTH = 500;

@Processor(QUEUE_NAMES.TOKEN_REFRESH)
@Injectable()
export class RefreshConnectionProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshConnectionProcessor.name);

  constructor(
    private readonly useCase: RefreshTokenUseCase,
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
  ) {
    super();
  }

  async process(job: Job<RefreshConnectionJobData>): Promise<void> {
    if (job.name !== "refresh-connection") return;
    await this.useCase.execute(job.data.connectionId);
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<RefreshConnectionJobData>,
    error: Error,
  ): Promise<void> {
    if (error instanceof UnrecoverableError) return;

    const maxAttempts = job.opts?.attempts ?? 5;
    if (job.attemptsMade < maxAttempts) return;

    const connectionId = job.data?.connectionId;
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
