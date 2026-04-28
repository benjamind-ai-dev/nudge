/**
 * Minimal payload types derived from Stripe events.
 * We don't import the Stripe SDK in the worker — events arrive as
 * plain JSON via BullMQ and are typed here with only the fields we use.
 */

export interface StripeCheckoutSession {
  id: string;
  customer: string | null;
  subscription: string | null;
  customer_email: string | null;
  metadata: Record<string, string> | null;
}

export interface StripeInvoice {
  id: string;
  customer: string | null;
  amount_paid: number;
  currency: string;
  subscription: string | null;
}

export interface StripeSubscriptionItem {
  price: { id: string } | null;
  current_period_end?: number;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: { data: StripeSubscriptionItem[] };
  cancel_at_period_end: boolean;
  trial_end: number | null;
}

export interface StripeEventEnvelope<T> {
  id: string;
  type: string;
  data: { object: T };
}
