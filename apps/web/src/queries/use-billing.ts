import { useMutation, useQuery } from "@tanstack/react-query";
import { createCheckout, getBillingStatus, type BillingPlan } from "../api/billing.api";

export const billingKeys = {
  status: ["billing", "status"] as const,
};

export function useBillingStatus() {
  return useQuery({
    queryKey: billingKeys.status,
    queryFn: () => getBillingStatus().then((r) => r.data),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (plan: BillingPlan) => createCheckout(plan).then((r) => r.data),
  });
}
