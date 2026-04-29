import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type StripeEventsJobData } from "@nudge/shared";
import { HandleCheckoutCompletedUseCase } from "./application/handle-checkout-completed.use-case";
import { HandlePaymentSucceededUseCase } from "./application/handle-payment-succeeded.use-case";
import { HandlePaymentFailedUseCase } from "./application/handle-payment-failed.use-case";
import { HandleSubscriptionUpdatedUseCase } from "./application/handle-subscription-updated.use-case";
import { HandleSubscriptionDeletedUseCase } from "./application/handle-subscription-deleted.use-case";
import { HandleGracePeriodCheckUseCase } from "./application/handle-grace-period-check.use-case";
import { GRACE_PERIOD_EVENT_TYPE } from "./application/handle-payment-failed.use-case";

@Processor(QUEUE_NAMES.STRIPE_EVENTS, { concurrency: 1 })
@Injectable()
export class StripeEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(StripeEventsProcessor.name);

  constructor(
    private readonly handleCheckoutCompleted: HandleCheckoutCompletedUseCase,
    private readonly handlePaymentSucceeded: HandlePaymentSucceededUseCase,
    private readonly handlePaymentFailed: HandlePaymentFailedUseCase,
    private readonly handleSubscriptionUpdated: HandleSubscriptionUpdatedUseCase,
    private readonly handleSubscriptionDeleted: HandleSubscriptionDeletedUseCase,
    private readonly handleGracePeriodCheck: HandleGracePeriodCheckUseCase,
  ) {
    super();
  }

  async process(job: Job<StripeEventsJobData>): Promise<void> {
    const { eventType, eventId, payload } = job.data;

    this.logger.log({
      msg: "Processing Stripe event",
      event: "stripe_event_processing",
      eventId,
      eventType,
    });

    switch (eventType) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted.execute(payload);
        break;

      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded.execute(payload);
        break;

      case "invoice.payment_failed":
        await this.handlePaymentFailed.execute(payload);
        break;

      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated.execute(payload);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted.execute(payload);
        break;

      case GRACE_PERIOD_EVENT_TYPE:
        await this.handleGracePeriodCheck.execute(payload);
        break;

      default:
        this.logger.log({
          msg: "Unhandled Stripe event type — skipping",
          event: "stripe_event_unhandled",
          eventId,
          eventType,
        });
    }

    this.logger.log({
      msg: "Stripe event processed",
      event: "stripe_event_processed",
      eventId,
      eventType,
    });
  }
}
