import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type ResendEventsJobData } from "@nudge/shared";
import { HandleEmailDeliveredUseCase } from "./application/handle-email-delivered.use-case";
import { HandleEmailOpenedUseCase } from "./application/handle-email-opened.use-case";
import { HandleEmailClickedUseCase } from "./application/handle-email-clicked.use-case";
import { HandleEmailBouncedUseCase } from "./application/handle-email-bounced.use-case";
import { HandleEmailComplainedUseCase } from "./application/handle-email-complained.use-case";
import { HandleEmailFailedUseCase } from "./application/handle-email-failed.use-case";
import { HandleEmailReceivedUseCase } from "./application/handle-email-received.use-case";

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
  };
}

@Processor(QUEUE_NAMES.RESEND_EVENTS, { concurrency: 1 })
@Injectable()
export class ResendEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(ResendEventsProcessor.name);

  constructor(
    private readonly handleDelivered: HandleEmailDeliveredUseCase,
    private readonly handleOpened: HandleEmailOpenedUseCase,
    private readonly handleClicked: HandleEmailClickedUseCase,
    private readonly handleBounced: HandleEmailBouncedUseCase,
    private readonly handleComplained: HandleEmailComplainedUseCase,
    private readonly handleFailed: HandleEmailFailedUseCase,
    private readonly handleReceived: HandleEmailReceivedUseCase,
  ) {
    super();
  }

  async process(job: Job<ResendEventsJobData>): Promise<void> {
    const events = job.data.payload as ResendEvent[];

    this.logger.log({
      msg: "Processing Resend events batch",
      event: "resend_events_processing",
      count: events.length,
    });

    for (const rawEvent of events) {
      if (rawEvent?.type === "email.received") {
        await this.dispatchEvent(rawEvent, "");
        continue;
      }

      const emailId = rawEvent?.data?.email_id;

      if (!emailId) {
        this.logger.warn({
          msg: "Resend event missing data.email_id — skipping",
          type: rawEvent?.type,
        });
        continue;
      }

      await this.dispatchEvent(rawEvent, emailId);
    }

    this.logger.log({
      msg: "Resend events batch processed",
      event: "resend_events_processed",
      count: events.length,
    });
  }

  private async dispatchEvent(event: ResendEvent, emailId: string): Promise<void> {
    switch (event.type) {
      case "email.delivered":
        await this.handleDelivered.execute({ externalMessageId: emailId });
        break;

      case "email.opened":
        await this.handleOpened.execute({
          externalMessageId: emailId,
          openedAt: new Date(event.created_at),
        });
        break;

      case "email.clicked":
        await this.handleClicked.execute({
          externalMessageId: emailId,
          clickedAt: new Date(event.created_at),
        });
        break;

      case "email.bounced":
        await this.handleBounced.execute({ externalMessageId: emailId });
        break;

      case "email.complained":
        await this.handleComplained.execute({ externalMessageId: emailId });
        break;

      case "email.failed":
        await this.handleFailed.execute({ externalMessageId: emailId });
        break;

      case "email.received": {
        const from = event.data.from;
        if (!from) {
          this.logger.warn({ msg: "email.received missing data.from — skipping" });
          break;
        }
        const senderEmail = from.includes("<") ? from.split("<")[1].replace(">", "").trim() : from.trim();
        await this.handleReceived.execute({ fromEmail: senderEmail });
        break;
      }

      default:
        this.logger.warn({
          msg: "Unhandled Resend event type — skipping",
          event: "resend_event_unhandled",
          type: event.type,
          emailId,
        });
    }
  }
}
