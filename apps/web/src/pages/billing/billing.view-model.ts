import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useBillingStatus } from "../../queries/use-billing";
import { createCheckout, createPortal, type BillingPlan } from "../../api/billing.api";

export function useBillingViewModel() {
  const { data: status, isLoading, error } = useBillingStatus();
  const [searchParams] = useSearchParams();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const redirectStatus = searchParams.get("status") as "success" | "cancelled" | null;

  const hasActiveSubscription =
    status?.has_stripe_customer === true && status.status !== "canceled";

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
    isCheckingOut,
    isOpeningPortal,
    handleCheckout,
    handlePortal,
  };
}
