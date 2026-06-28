import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getCustomers } from "../api/customers.api";

export interface UseCustomersParams {
  businessId: string;
  search?: string;
  hasOverdue?: boolean;
}

export function useCustomers(params: UseCustomersParams) {
  return useQuery({
    queryKey: ["customers", params.businessId, params.search ?? "", params.hasOverdue ?? false],
    queryFn: () => getCustomers({ ...params, limit: 100 }),
    enabled: Boolean(params.businessId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
