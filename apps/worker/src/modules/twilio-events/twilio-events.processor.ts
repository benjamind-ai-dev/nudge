import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type TwilioEventsJobData } from "@nudge/shared";
import { HandleSmsReceivedUseCase } from "./application/handle-sms-received.use-case";

@Processor(QUEUE_NAMES.TWILIO_EVENTS, { concurrency: 1 })
@Injectable()
export class TwilioEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(TwilioEventsProcessor.name);

  constructor(private readonly handleSmsReceived: HandleSmsReceivedUseCase) {
    super();
  }

  async process(job: Job<TwilioEventsJobData>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case "sms.received":
        if (!data.from) {
          this.logger.warn({
            msg: "twilio sms.received missing from — skipping",
            event: "twilio_sms_no_from",
          });
          return;
        }
        await this.handleSmsReceived.execute({
          fromPhone: data.from,
          replyBody: data.body ?? "",
        });
        return;

      default:
        this.logger.warn({
          msg: "Unhandled Twilio event type — skipping",
          event: "twilio_event_unhandled",
          type: (data as { type: string }).type,
        });
    }
  }
}
