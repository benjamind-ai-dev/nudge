import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { IngestStripeEventUseCase } from "./application/ingest-stripe-event.use-case";
import {
  StripeWebhookGuard,
  STRIPE_EVENT_KEY,
} from "./infrastructure/stripe-webhook.guard";
import { DuplicateStripeEventError } from "./domain/stripe-webhook.errors";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "../../common/throttler/throttler-config";

@SkipThrottle({ [RATE_LIMIT_NAMES.DEFAULT]: true, [RATE_LIMIT_NAMES.AUTH]: true })
@Throttle({ [RATE_LIMIT_NAMES.WEBHOOKS]: RATE_LIMITS.WEBHOOKS })
@Controller("v1/webhooks/stripe")
export class StripeWebhookController {
  constructor(private readonly ingestEvent: IngestStripeEventUseCase) {}

  @Post()
  @HttpCode(200)
  @UseGuards(StripeWebhookGuard)
  async handle(@Req() req: Request & Record<string, unknown>): Promise<void> {
    const event = req[STRIPE_EVENT_KEY] as { id: string; type: string };

    try {
      await this.ingestEvent.execute({
        eventId: event.id,
        eventType: event.type,
        payload: event,
      });
    } catch (err) {
      if (err instanceof DuplicateStripeEventError) {
        // Idempotent — still return 200 so Stripe stops retrying
        return;
      }
      throw err;
    }
  }
}
