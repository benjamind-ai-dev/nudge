import { apiClient } from "./client";

export type BillingPlan = "starter" | "growth" | "agency";

export interface BillingStatus {
  plan: BillingPlan | null;
  status: "trial" | "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
}

export function getBillingStatus(): Promise<{ data: BillingStatus }> {
  return apiClient<{ data: BillingStatus }>("/v1/billing/status");
}

export function createCheckout(
  plan: BillingPlan,
): Promise<{ data: { checkout_url: string } }> {
  return apiClient<{ data: { checkout_url: string } }>(
    "/v1/billing/create-checkout",
    {
      method: "POST",
      body: JSON.stringify({ plan }),
    },
  );
}

export function createPortal(): Promise<{ data: { portal_url: string } }> {
  return apiClient<{ data: { portal_url: string } }>(
    "/v1/billing/create-portal",
    { method: "POST" },
  );
}
