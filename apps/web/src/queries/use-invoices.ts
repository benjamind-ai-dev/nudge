import { useQuery } from "@tanstack/react-query";
import { listInvoices, type ListInvoicesParams } from "../api/invoices.api";

export function useInvoices(params: ListInvoicesParams) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: () => listInvoices(params),
    enabled: Boolean(params.businessId),
    staleTime: 30_000,
  });
}
