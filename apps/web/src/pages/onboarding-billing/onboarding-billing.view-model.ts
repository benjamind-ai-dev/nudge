import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useCreateCheckout } from "../../queries/use-billing";
import type { BillingPlan } from "../../api/billing.api";
import type { PlanCardData } from "../../components/plan-card";

// Plan copy mirrors the enforced backend limits (PLAN_LIMITS):
// seats, sequences-per-business, SMS gate. No unenforced claims.
const PLANS: PlanCardData[] = [
  {
    plan: "starter",
    name: "Starter",
    priceLabel: "$79",
    tagline: "For solo operators.",
    features: [
      "1 team member",
      "2 follow-up sequences",
      "Email reminders",
      "QuickBooks or Xero",
      "Email support",
    ],
  },
  {
    plan: "growth",
    name: "Growth",
    priceLabel: "$150",
    tagline: "For growing teams.",
    featured: true,
    features: [
      "5 team members",
      "10 follow-up sequences",
      "Email + SMS reminders",
      "QuickBooks + Xero",
      "Priority support",
    ],
  },
  {
    plan: "agency",
    name: "Agency",
    priceLabel: "$250",
    tagline: "For firms managing AR.",
    features: [
      "15 team members",
      "Unlimited follow-up sequences",
      "Email + SMS reminders",
      "QuickBooks + Xero",
      "Priority + onboarding call",
    ],
  },
];

export function useOnboardingBillingViewModel() {
  const [params] = useSearchParams();
  const checkout = useCreateCheckout();
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);

  const preselectedPlan = params.get("plan") as BillingPlan | null;
  const showCancelledBanner = params.get("cancelled") === "true";

  const handleChoose = useCallback(
    async (plan: BillingPlan) => {
      setError(null);
      setPendingPlan(plan);
      try {
        const { checkout_url } = await checkout.mutateAsync(plan);
        // External Stripe URL — full navigation, not react-router.
        window.location.href = checkout_url;
      } catch (e) {
        setPendingPlan(null);
        setError(
          e instanceof Error ? e.message : "Couldn't start checkout. Try again.",
        );
      }
    },
    [checkout],
  );

  return {
    plans: PLANS,
    preselectedPlan,
    showCancelledBanner,
    isRedirecting: checkout.isPending,
    pendingPlan,
    error,
    handleChoose,
  };
}
