import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { Env } from "../../../common/config/env.schema";
import {
  type StripeService,
  type CreateCheckoutSessionParams,
  type CheckoutSessionResult,
  type CreatePortalSessionParams,
  type PortalSessionResult,
  type StripeSubscriptionInfo,
} from "../domain/stripe.service";
import { BillingPlan } from "../domain/billing.entity";

@Injectable()
export class StripeBillingService implements StripeService {
  private readonly logger = new Logger(StripeBillingService.name);
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly priceMap: Record<BillingPlan, string>;
  private readonly planFromPrice: Record<string, BillingPlan>;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.stripe = new Stripe(config.get("STRIPE_SECRET_KEY", { infer: true }), {
      apiVersion: "2026-03-25.dahlia",
    });

    this.frontendUrl = config.get("FRONTEND_URL", { infer: true });

    this.priceMap = {
      starter: config.get("STRIPE_PRICE_STARTER", { infer: true }),
      growth: config.get("STRIPE_PRICE_GROWTH", { infer: true }),
      agency: config.get("STRIPE_PRICE_AGENCY", { infer: true }),
    };

    this.planFromPrice = Object.fromEntries(
      Object.entries(this.priceMap).map(([plan, priceId]) => [
        priceId,
        plan as BillingPlan,
      ]),
    );
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const priceId = this.priceMap[params.plan];
    const successUrl = `${this.frontendUrl}/settings/billing?status=success`;
    const cancelUrl = `${this.frontendUrl}/settings/billing?status=cancelled`;

    const buildSessionParams = (customerId?: string) => ({
      mode: "subscription" as const,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { account_id: params.accountId, plan: params.plan },
      subscription_data: {
        metadata: { account_id: params.accountId, plan: params.plan },
        ...(!customerId && params.isNewCustomer && { trial_period_days: 14 }),
      },
      ...(customerId ? { customer: customerId } : {}),
    });

    let session;
    try {
      session = await this.stripe.checkout.sessions.create(
        buildSessionParams(params.stripeCustomerId ?? undefined),
      );
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.message.includes("No such customer")
      ) {
        session = await this.stripe.checkout.sessions.create(
          buildSessionParams(),
        );
      } else {
        throw err;
      }
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? "");

    return { checkoutUrl: session.url, stripeCustomerId: customerId };
  }

  async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<PortalSessionResult> {
    const returnUrl = `${this.frontendUrl}/settings/billing?portal_return=1`;
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: returnUrl,
    });

    return { portalUrl: session.url };
  }

  async getSubscriptionInfo(
    stripeCustomerId: string,
    stripeSubscriptionId?: string | null,
  ): Promise<StripeSubscriptionInfo | null> {
    type Sub = {
      status: string;
      cancel_at_period_end: boolean;
      cancel_at: number | null;
      trial_end: number | null;
      items: { data: { price?: { id: string } | null; current_period_end?: number }[] };
    };

    let sub: Sub | null = null;

    if (stripeSubscriptionId) {
      const retrieved = await this.stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        { expand: ["items.data.price"] },
      );
      this.logger.warn({
        msg: "stripe_sub_debug",
        id: retrieved.id,
        status: retrieved.status,
        cancel_at_period_end: retrieved.cancel_at_period_end,
        cancel_at: retrieved.cancel_at,
      });
      if (retrieved.status !== "canceled") sub = retrieved as unknown as Sub;
    }

    if (!sub) {
      const list = await this.stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 10,
        status: "all",
        expand: ["data.items.data.price"],
      });
      sub =
        (list.data.find((s) => s.status !== "canceled") as unknown as Sub) ??
        null;
    }

    if (!sub) return null;

    const item = sub.items.data[0];
    const priceId = item?.price?.id ?? null;
    const plan = priceId ? (this.planFromPrice[priceId] ?? null) : null;

    // In Stripe API 2026-03-25.dahlia, current_period_end moved from
    // the Subscription to the SubscriptionItem
    const periodEnd = item?.current_period_end ?? null;

    return {
      plan,
      status: sub.status,
      currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
      // Stripe portal sets cancel_at (specific timestamp) instead of cancel_at_period_end
      // in flexible billing mode — treat either as "scheduled to cancel"
      cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at != null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    };
  }
}
