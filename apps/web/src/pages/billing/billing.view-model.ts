import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingStatus, billingKeys } from "../../queries/use-billing";
import { createCheckout, createPortal, type BillingPlan } from "../../api/billing.api";

export function useBillingViewModel() {
  const queryClient = useQueryClient();
  const { data: status, isLoading, error } = useBillingStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const redirectStatus = searchParams.get("status") as "success" | "cancelled" | null;

  useEffect(() => {
    if (searchParams.get("portal_return") === "1") {
      void queryClient.invalidateQueries({ queryKey: billingKeys.status });
      setSearchParams((p) => { p.delete("portal_return"); return p; }, { replace: true });
    }
  }, [searchParams, queryClient, setSearchParams]);

  const hasActiveSubscription =
    status?.has_stripe_customer === true && status.status !== "canceled";

  const currentPlanId =
    !status?.cancel_at_period_end &&
    (status?.status === "active" || status?.status === "trial")
      ? (status.plan ?? null)
      : null;

  const handleCheckout = useCallback(async (plan: BillingPlan) => {
    setIsCheckingOut(true);
    try {
      const result = await createCheckout(plan);
      window.location.href = result.data.checkout_url;
    } finally {
      setIsCheckingOut(false);
    }
  }, []);

  const handlePortal = useCallback(async () => {
    setIsOpeningPortal(true);
    try {
      const result = await createPortal();
      window.location.href = result.data.portal_url;
    } finally {
      setIsOpeningPortal(false);
    }
  }, []);

  return {
    status,
    isLoading,
    error,
    redirectStatus,
    hasActiveSubscription,
    currentPlanId,
    isCheckingOut,
    isOpeningPortal,
    handleCheckout,
    handlePortal,
  };
}
