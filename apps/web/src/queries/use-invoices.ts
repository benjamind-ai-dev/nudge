import { useInfiniteQuery } from "@tanstack/react-query";
import { listInvoices } from "../api/invoices.api";

const PAGE_LIMIT = 100;
// Backstop so a large account can't trigger an unbounded fetch loop.
const MAX_PAGES = 20;

/**
 * Loads invoices page-by-page via cursor. The view model auto-advances through
 * all pages (up to MAX_PAGES) so it can sort/search/filter/paginate the full
 * set client-side.
 */
export function useInvoicesInfinite(businessId: string) {
  return useInfiniteQuery({
    queryKey: ["invoices", "infinite", businessId],
    queryFn: ({ pageParam }) =>
      listInvoices({
        businessId,
        limit: PAGE_LIMIT,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage, allPages) =>
      allPages.length >= MAX_PAGES ? undefined : lastPage.pagination.nextCursor,
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}
