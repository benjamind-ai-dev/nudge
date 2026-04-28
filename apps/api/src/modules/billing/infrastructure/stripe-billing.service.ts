import { Injectable } from "@nestjs/common";
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

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        account_id: params.accountId,
        plan: params.plan,
      },
      subscription_data: {
        metadata: {
          account_id: params.accountId,
          plan: params.plan,
        },
        ...(params.isNewCustomer && { trial_period_days: 14 }),
      },
      ...(params.stripeCustomerId && { customer: params.stripeCustomerId }),
    });

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
    const returnUrl = `${this.frontendUrl}/settings/billing`;
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: returnUrl,
    });

    return { portalUrl: session.url };
  }

  async getSubscriptionInfo(
    stripeCustomerId: string,
  ): Promise<StripeSubscriptionInfo | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
      status: "all",
      expand: ["data.items.data.price"],
    });

    const subscription = subscriptions.data[0];
    if (!subscription) {
      return null;
    }

    const item = subscription.items.data[0];
    const price = item?.price;
    const priceId =
      typeof price === "object" && price !== null ? price.id : null;
    const plan = priceId ? (this.planFromPrice[priceId] ?? null) : null;

    // In Stripe API 2026-03-25.dahlia, current_period_end moved from
    // the Subscription to the SubscriptionItem
    const periodEnd = item?.current_period_end ?? null;

    return {
      plan,
      status: subscription.status,
      currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    };
  }
}
