import { BillingPlan } from "./billing.entity";

export interface CreateCheckoutSessionParams {
  accountId: string;
  plan: BillingPlan;
  stripeCustomerId: string | null;
  isNewCustomer: boolean;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  stripeCustomerId: string;
}

export interface CreatePortalSessionParams {
  stripeCustomerId: string;
}

export interface PortalSessionResult {
  portalUrl: string;
}

export interface StripeSubscriptionInfo {
  plan: BillingPlan | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

export interface StripeService {
  createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult>;

  createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<PortalSessionResult>;

  getSubscriptionInfo(
    stripeCustomerId: string,
  ): Promise<StripeSubscriptionInfo | null>;
}

export const STRIPE_SERVICE = Symbol("StripeService");
