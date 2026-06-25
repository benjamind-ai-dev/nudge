import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listInvoices, startFollowUp, type StartFollowUpBody } from "../api/invoices.api";

/**
 * Fetches all overdue invoices sorted by amount descending.
 * Fixed filters — no pagination needed for the worklist view (one page of overdue items).
 *
 * v1 limitation: results are capped at 100 (the API's max page size). Businesses with
 * >100 overdue invoices will silently see only the top 100 by amount. Tracked for
 * pagination support in a future release.
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
        limit: 100,
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
      body,
    }: {
      invoiceId: string;
      businessId: string;
      body?: StartFollowUpBody;
    }) => startFollowUp(invoiceId, businessId, body),
    onSuccess: (data, { businessId }) => {
      // Only invalidate when a new run was actually created; skip for already_running
      // to avoid an unnecessary refetch when nothing changed.
      if (data.data.created === true) {
        qc.invalidateQueries({ queryKey: ["invoices", "overdue", businessId] });
      }
    },
  });
}
