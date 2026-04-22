import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, type MessageSendJobData } from "@nudge/shared";
import {
  MESSAGE_SEND_REPOSITORY,
  type MessageSendRepository,
} from "../domain/message-send.repository";
import { JOB_NAMES } from "../constants";

export interface EnqueueResult {
  runsEnqueued: number;
}

@Injectable()
export class EnqueueReadyRunsUseCase {
  private readonly logger = new Logger(EnqueueReadyRunsUseCase.name);

  constructor(
    @Inject(MESSAGE_SEND_REPOSITORY)
    private readonly repo: MessageSendRepository,
    @InjectQueue(QUEUE_NAMES.MESSAGE_SEND)
    private readonly queue: Queue,
  ) {}

  async execute(): Promise<EnqueueResult> {
    const runs = await this.repo.findRunsReadyToSend();

    for (const run of runs) {
      const jobData: MessageSendJobData = {
        sequenceRunId: run.runId,
        businessId: run.businessId,
      };

      await this.queue.add(JOB_NAMES.SEND_MESSAGE, jobData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60_000,
        },
      });

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
