---
name: react-viewmodel-expert
description: Use when creating, modifying, or scaffolding frontend pages, components, view models, query hooks, or stores in apps/web. Use when the user asks to build a screen, wire a page to the API, add a form, table, list, or any React feature in the Nudge web app.
---

# React ViewModel Expert — Nudge Frontend Patterns

## Overview

This skill provides the exact code patterns for building React screens in the Nudge web app (`apps/web`). Every screen follows the **ViewModel pattern**: the page is glue, the view model holds all logic, components are dumb, and data flows through query hooks wrapping a typed API client.

**CLAUDE.md and `.claude/rules/frontend.react.rule.md` have the rules. This skill has the code.**

Core principle: **components don't do logic, view models don't do rendering.**

## When to Use

- Building a new route/screen in `apps/web`
- Wiring a page to backend endpoints
- Adding a list, table, form, detail drawer, or modal
- Adding search/filter/sort/pagination to a page
- Adding a mutation (create/update/delete) with toasts + cache invalidation
- Creating query hooks or utility hooks (debounce, etc.)

## The layer stack

```
Page (.page.tsx)        → glue only: calls the view model, passes props to components
ViewModel (.view-model.ts) → ALL logic: state, derived data, callbacks, side effects
Query hooks (queries/)  → TanStack Query wrappers around api/ functions
API functions (api/)    → typed fetch calls via client.ts
Components (components/) → pure props → JSX, zero logic
Stores (stores/)        → Zustand, client-only UI state
```

| Layer | Does | Never |
|---|---|---|
| `api/*.api.ts` | fetch via `client.ts`, typed req/res | state, hooks, caching |
| `queries/use-*.ts` | TanStack Query hooks | business logic, transforms |
| `*.view-model.ts` | state, derived data, callbacks, effects | JSX, CSS |
| `*.page.tsx` | wire view model → components | useState/useEffect/useMemo, logic |
| `components/*` | render props | fetching, state, business logic |
| `stores/*.store.ts` | client-only UI state (Zustand) | server data |

## Folder layout for a feature

```
apps/web/src/
  api/customers.api.ts              → listCustomers(), getCustomer()
  queries/use-customers.ts          → useCustomers(), useCustomer(), useAssignTier()
  pages/customers/
    customers.page.tsx              → glue
    customers.view-model.ts         → all logic
  components/
    customer-table.tsx              → dumb
  lib/hooks/use-debounce.ts         → reusable util hook
```

## Layer 1 — API function

`client.ts` exports a single generic function — **`apiClient<T>(path, options?: RequestInit)`**. There are NO `.get`/`.post` method helpers and NO automatic query-string/`params` serialization. Build query strings with `URLSearchParams`; pass `method`/`body` via `RequestInit`. Every endpoint returns the envelope **`{ data: T }`** (lists are `{ data: T[] }`; paginated endpoints add their own `pagination` field — endpoint-specific, not universal).

```ts
// api/customers.api.ts
import { apiClient } from "./client";

// Co-locate response types here unless the type already exists in @nudge/shared.
// (Repo precedent: billing.api.ts defines BillingStatus locally.)
export interface Customer {
  id: string;
  companyName: string;
  contactEmail: string | null;
  relationshipTier: { id: string; name: string } | null;
  totalOutstanding: number;
  avgDaysToPay: number | null;
}

export interface ListCustomersParams {
  businessId: string;
  search?: string;
  tierId?: string;
  sortBy?: "company_name" | "total_outstanding" | "avg_days_to_pay";
  sortOrder?: "asc" | "desc";
  page?: number;
}

export function listCustomers(
  params: ListCustomersParams,
): Promise<{ data: Customer[]; pagination: { page: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  return apiClient(`/v1/customers?${qs}`);
}

export function assignTier(
  customerId: string,
  body: { businessId: string; tierId: string | null },
): Promise<{ data: Customer }> {
  return apiClient(`/v1/customers/${customerId}/tier`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
```

Rules:
- Plain functions, one per endpoint. No React, no state.
- Call `apiClient<T>(path, options)` — single generic fn. Build query strings with `URLSearchParams`. Never raw `fetch`. Never `axios`.
- Every response is `{ data: T }`. Type the return as `Promise<{ data: T }>`.
- Co-locate response types in the api file unless they already live in `@nudge/shared`.
- Return typed data; `apiClient` throws on non-2xx.

## Layer 2 — Query hooks

```ts
// queries/use-customers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCustomers, assignTier, type ListCustomersParams } from "../api/customers.api";

export function useCustomers(params: ListCustomersParams) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => listCustomers(params),
    enabled: Boolean(params.businessId), // guard the gap before Clerk org resolves
    staleTime: 30_000,
  });
}

export function useAssignTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, businessId, tierId }: {
      customerId: string; businessId: string; tierId: string | null;
    }) => assignTier(customerId, { businessId, tierId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
```

Rules:
- Thin wrappers around `api/`. No transforms here.
- Query key includes every param that changes the result (incl. `businessId`).
- Mutations invalidate the relevant query on success.

## Layer 3 — ViewModel (all logic lives here)

```ts
// pages/customers/customers.view-model.ts
import { useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useCustomers } from "../../queries/use-customers";
import { useDebounce } from "../../lib/hooks/use-debounce";
import { useBusinessId } from "../../lib/hooks/use-business-id";

export function useCustomersViewModel() {
  const businessId = useBusinessId();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // URL is the source of truth for filters — shareable + back-button safe.
  const search = params.get("search") ?? "";
  const tierId = params.get("tierId") ?? undefined;
  const sortBy = (params.get("sortBy") ?? "company_name") as const;
  const sortOrder = (params.get("sortOrder") ?? "asc") as "asc" | "desc";
  const page = Number(params.get("page") ?? "1");

  const debouncedSearch = useDebounce(search, 300);

  const query = useCustomers({
    businessId,
    search: debouncedSearch || undefined,
    tierId,
    sortBy,
    sortOrder,
    page,
  });

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.set("page", "1"); // reset paging on filter change
        return next;
      });
    },
    [setParams],
  );

  const hasActiveFilters = useMemo(
    () => Boolean(search || tierId),
    [search, tierId],
  );

  const handleRowClick = useCallback(
    (id: string) => navigate(`/customers/${id}`),
    [navigate],
  );

  const toggleSort = useCallback(
    (field: typeof sortBy) => {
      const nextOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("sortBy", field);
        next.set("sortOrder", nextOrder);
        return next;
      });
    },
    [sortBy, sortOrder, setParams],
  );

  return {
    customers: query.data?.data ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    search,
    tierId,
    sortBy,
    sortOrder,
    hasActiveFilters,
    setSearch: (v: string) => setParam("search", v),
    setTierId: (v: string | undefined) => setParam("tierId", v),
    clearFilters: () => setParams(new URLSearchParams()),
    setPage: (p: number) => setParam("page", String(p)),
    toggleSort,
    handleRowClick,
  };
}
```

Rules:
- The view model is a hook named `useXxxViewModel()`.
- It owns ALL state, derived data (`useMemo`), callbacks (`useCallback`), and effects.
- Returns a flat object — everything the page needs, nothing it doesn't.
- Formatting (money via `formatCents`, dates via `date-fns`) happens here, not in components.
- **URL-sync (`useSearchParams`) is for filtered/sorted/paginated lists** — it makes them shareable + back-button safe. For a small fixed list (e.g. ≤5 items, no filters), skip it; plain `useState` or no state at all is fine. Don't add the URL machinery where there's nothing to filter.

## Layer 4 — Page (glue only)

```tsx
// pages/customers/customers.page.tsx
import { useCustomersViewModel } from "./customers.view-model";
import { PageHeader } from "../../components/page-header";
import { FilterBar } from "../../components/filter-bar";
import { CustomerTable } from "../../components/customer-table";

export function CustomersPage() {
  const vm = useCustomersViewModel();

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${vm.pagination?.total ?? 0} customers`}
      />
      <FilterBar
        searchValue={vm.search}
        onSearchChange={vm.setSearch}
        hasActiveFilters={vm.hasActiveFilters}
        onClearAll={vm.clearFilters}
      />
      <CustomerTable
        customers={vm.customers}
        isLoading={vm.isLoading}
        sortBy={vm.sortBy}
        sortOrder={vm.sortOrder}
        onToggleSort={vm.toggleSort}
        onRowClick={vm.handleRowClick}
      />
    </>
  );
}
```

Rules:
- No `useState`, `useEffect`, `useMemo`, or logic in the page. If you're tempted, it belongs in the view model.
- The page destructures the view model and passes props down. That's it.

## Layer 5 — Component (dumb)

```tsx
// components/customer-table.tsx
import type { Customer } from "@nudge/shared";

interface CustomerTableProps {
  customers: Customer[];
  isLoading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onToggleSort: (field: "company_name" | "total_outstanding") => void;
  onRowClick: (id: string) => void;
}

export function CustomerTable(props: CustomerTableProps) {
  // Pure render. No fetching, no state (except local UI like hover).
  // ...renders the table from props...
}
```

Rules:
- Props explicitly typed — never spread the whole view model in.
- Same props → same output. No data fetching, no business state.
- Local UI-only state (animation, hover, controlled input mid-keystroke) is fine.

## Reusable utility hooks

```ts
// lib/hooks/use-debounce.ts
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

```ts
// lib/hooks/use-business-id.ts — active business = active Clerk organization
import { useOrganization } from "@clerk/clerk-react";

// Returns "" until the org resolves; callers guard queries with
// `enabled: Boolean(businessId)`.
export function useBusinessId(): string {
  const { organization } = useOrganization();
  return organization?.id ?? "";
}
```

Rules:
- Generic, reusable hooks live in `lib/hooks/`, not next to a single page.
- Util hooks are pure logic — no JSX.
- `businessId` comes from the active Clerk org (`useOrganization`). It's `""` on first render until the org resolves — always pair with `enabled: Boolean(businessId)` on dependent queries.

## Mutations with feedback + invalidation (in the view model)

**`sonner`/`toast` is NOT installed.** Surface mutation success/failure via view-model state rendered inline (repo precedent: `billing.page.tsx` shows banners). Don't import `toast` unless `sonner` has actually been added to `apps/web`.

```ts
const assignTier = useAssignTier();
const [actionError, setActionError] = useState<string | null>(null);

const handleAssignTier = useCallback(
  async (customerId: string, tierId: string) => {
    setActionError(null);
    try {
      await assignTier.mutateAsync({ customerId, businessId, tierId });
      // success: query hook's onSuccess already invalidated the cache → list refreshes
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't update tier");
    }
  },
  [assignTier, businessId],
);
```

Rules:
- Mutations are called from the view model, never from a component.
- Cache invalidation lives in the query hook's `onSuccess`. The view model handles user-facing feedback.
- Feedback = inline error state from the view model (no `sonner` in this repo yet). If `sonner` gets added later, swap the inline state for `toast` — but verify it's installed first.

## Loading / error / empty (per section)

- **Loading:** render skeletons in the component (driven by `vm.isLoading`). Never a single full-page spinner on a data screen.
- **Error:** view model exposes `error` + `refetch`; component shows an inline "Couldn't load. Retry" → `vm.refetch`.
- **Empty:** component renders `<EmptyState>` when `!isLoading && items.length === 0`.

## Testing (view model is the target)

```ts
// customers.view-model.test.tsx — test the hook with renderHook, mock the query hooks
```

Rules (see `.claude/rules/testing.rule.md`):
- Test the **view model** with `renderHook()` — assert on returned state, derived data, callbacks. Mock the query hooks.
- Don't test pages (glue) or api functions (thin wrappers).
- Only test components with significant conditional rendering.

## Quick Reference

| Task | Pattern |
|---|---|
| New screen | `api/` fn → `queries/` hook → `*.view-model.ts` → `*.page.tsx` → dumb components |
| Add filter/sort/search | State in view model, synced to URL via `useSearchParams`; debounce search with `useDebounce` |
| Add pagination | View model reads `page` from URL, passes to query; component renders footer + `vm.setPage` |
| Add a mutation | `useMutation` in query hook (invalidate `onSuccess`) → call `mutateAsync` in view model → inline feedback state |
| Add a detail drawer/modal | `selectedId` state in view model; lazy `useXDetail(id)` query `enabled` when open |
| Reusable logic (debounce, etc.) | Hook in `lib/hooks/` |
| Client-only UI state | Zustand store in `stores/*.store.ts` |
| Format money/date | In the view model: `formatCents` from `@nudge/shared`, `date-fns` for dates |

## Common Mistakes

| Mistake | Fix |
|---|---|
| `useState`/`useEffect` in a page or component for data | Move to the view model |
| Logic/derived data in the page | Move to the view model; page is glue only |
| Raw `fetch()` in a component or view model | Use an `api/*.api.ts` function |
| `axios` in the frontend | Use `client.ts` |
| Query hook doing data transforms | Transform in the view model |
| Spreading the whole view model into a component | Pass explicit, typed props |
| `localStorage` for state | Zustand (with persist middleware if needed) |
| `React.useContext` for app state | Zustand store |
| Full-page spinner on a data screen | Per-section skeletons |
| Default export on a page/component | Named exports everywhere |
| Mutation called from a component | Call from the view model; component emits a callback |
| Testing the page or api fn | Test the view model with `renderHook` |
