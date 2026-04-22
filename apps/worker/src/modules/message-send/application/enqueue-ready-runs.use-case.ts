import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  MESSAGE_SEND_REPOSITORY,
  type MessageSendRepository,
} from "../domain/message-send.repository";
import {
  MESSAGE_QUEUE_SERVICE,
  type MessageQueueService,
} from "../domain/message-queue.service";

export interface EnqueueResult {
  runsEnqueued: number;
}

@Injectable()
export class EnqueueReadyRunsUseCase {
  private readonly logger = new Logger(EnqueueReadyRunsUseCase.name);

  constructor(
    @Inject(MESSAGE_SEND_REPOSITORY)
    private readonly repo: MessageSendRepository,
    @Inject(MESSAGE_QUEUE_SERVICE)
    private readonly queueService: MessageQueueService,
  ) {}

  async execute(): Promise<EnqueueResult> {
    const runs = await this.repo.findRunsReadyToSend();

    for (const run of runs) {
      await this.queueService.enqueueSendMessage(
        {
          sequenceRunId: run.runId,
          businessId: run.businessId,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 60_000,
          },
        },
      );

      this.logger.debug({
        msg: "Enqueued send-message job",
        event: "send_message_enqueued",
        sequenceRunId: run.runId,
        businessId: run.businessId,
        invoiceNumber: run.invoiceNumber,
        channel: run.stepChannel,
      });
    }

    return { runsEnqueued: runs.length };
  }
}
