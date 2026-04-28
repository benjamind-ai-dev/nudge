import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import Stripe from "stripe";
import type { Env } from "../../../common/config/env.schema";

export const STRIPE_EVENT_KEY = "stripeEvent";

type StripeEvent = ReturnType<
  InstanceType<typeof Stripe>["webhooks"]["constructEvent"]
>;

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.stripe = new Stripe(config.get("STRIPE_SECRET_KEY", { infer: true }), {
      apiVersion: "2026-03-25.dahlia",
    });
    this.webhookSecret = config.get("STRIPE_WEBHOOK_SECRET", { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request> & Record<string, unknown>>();

    const rawBody = req.rawBody;
    const signature = req.headers[STRIPE_SIGNATURE_HEADER];
    const sigStr = Array.isArray(signature) ? signature[0] : signature;

    if (!rawBody?.length || !sigStr) {
      this.reject("missing_body_or_signature");
    }

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody as Buffer,
        sigStr as string,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.warn({
        msg: "Stripe webhook signature verification failed",
        event: "stripe_webhook_invalid_signature",
        error: err instanceof Error ? err.message : String(err),
      });
      throw new BadRequestException("Invalid Stripe webhook signature");
    }

    req[STRIPE_EVENT_KEY] = event;
    return true;
  }

  private reject(reason: string): never {
    this.logger.warn({
      msg: "Stripe webhook rejected",
      event: "stripe_webhook_rejected",
      reason,
    });
    throw new BadRequestException(`Stripe webhook rejected: ${reason}`);
  }
}
