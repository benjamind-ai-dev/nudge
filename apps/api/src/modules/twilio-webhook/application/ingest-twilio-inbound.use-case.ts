import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUE_NAMES, type TwilioEventsJobData } from "@nudge/shared";

const TWILIO_INBOUND_JOB_NAME = "process-sms-received";

export interface IngestTwilioInboundInput {
  messageSid: string;
  from: string;
  to: string;
  body: string;
}

@Injectable()
export class IngestTwilioInboundUseCase {
  private readonly logger = new Logger(IngestTwilioInboundUseCase.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.TWILIO_EVENTS)
    private readonly queue: Queue<TwilioEventsJobData>,
  ) {}

  async execute(input: IngestTwilioInboundInput): Promise<void> {
    await this.queue.add(
      TWILIO_INBOUND_JOB_NAME,
      {
        type: "sms.received",
        messageSid: input.messageSid,
        from: input.from,
        to: input.to,
        body: input.body,
      },
      {
        jobId: `sms-received:${input.messageSid}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        // 24h retention guarantees BullMQ's jobId dedupe still catches Twilio's
        // retry window (~5h). Count-based retention would evict the original
        // on a busy queue and let duplicates re-fire alert emails.
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    );

    this.logger.log({
      msg: "Twilio inbound SMS enqueued",
      event: "twilio_inbound_enqueued",
      messageSid: input.messageSid,
    });
  }
}
