import { useQuery } from "@tanstack/react-query";
import { getBillingStatus } from "../api/billing.api";

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
