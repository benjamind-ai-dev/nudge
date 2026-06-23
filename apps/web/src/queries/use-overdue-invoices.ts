import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listInvoices, startFollowUp } from "../api/invoices.api";

/**
 * Fetches all overdue invoices sorted by amount descending.
 * Fixed filters — no pagination needed for the worklist view (one page of overdue items).
 */
export function useOverdueInvoices(businessId: string) {
  return useQuery({
    queryKey: ["invoices", "overdue", businessId],
    queryFn: () =>
      listInvoices({
        businessId,
        status: "overdue",
        sortBy: "amount_cents",
        sortOrder: "desc",
        limit: 200,
      }),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useStartFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      businessId,
    }: {
      invoiceId: string;
      businessId: string;
    }) => startFollowUp(invoiceId, businessId),
    onSuccess: (_data, { businessId }) => {
      qc.invalidateQueries({ queryKey: ["invoices", "overdue", businessId] });
    },
  });
}
