---
paths:
  - "apps/web/**/*"
---

# Frontend Rules — React + Vite

## Folder Structure

```
apps/web/src/
├── main.tsx
├── App.tsx
├── index.css
│
├── lib/
│   └── utils.ts                        → clsx, cn helpers
│
├── api/                                 → Raw fetch functions (one per resource)
│   ├── client.ts                        → Base fetch wrapper (auth headers, base URL, error handling)
│   ├── invoices.api.ts                  → getInvoices(), getInvoice(), createInvoice()
│   ├── customers.api.ts
│   └── sequences.api.ts
│
├── queries/                             → React Query hooks (thin wrappers around api/)
│   ├── use-invoices.ts                  → useInvoices(), useInvoice(), useCreateInvoice()
│   ├── use-customers.ts
│   └── use-sequences.ts
│
├── components/                          → Dumb UI components (zero logic, just props → JSX)
│   ├── ui/                              → shadcn/ui primitives (button, input, dialog)
│   ├── invoice-table.tsx
│   ├── invoice-row.tsx
│   ├── customer-card.tsx
│   └── empty-state.tsx
│
├── pages/                               → Route-level components (one folder per route)
│   ├── invoices/
│   │   ├── invoices.page.tsx            → Glue: connects view model to components
│   │   └── invoices.view-model.ts       → useInvoicesViewModel() — all logic here
│   ├── invoices/[id]/
│   │   ├── invoice-detail.page.tsx
│   │   └── invoice-detail.view-model.ts
│   ├── dashboard/
│   │   ├── dashboard.page.tsx
│   │   └── dashboard.view-model.ts
│   └── settings/
│       ├── settings.page.tsx
│       └── settings.view-model.ts
│
└── stores/                              → Zustand stores (client-only state)
    └── ui.store.ts                      → Sidebar open, active filters, etc.
```

## ViewModel Pattern

The core architecture rule: **components don't do logic, view models don't do rendering**.

### Layer Responsibilities

| Layer | Does | Does NOT |
|---|---|---|
| `api/` | Raw fetch calls, request/response typing | State management, caching, React hooks |
| `queries/` | TanStack Query hooks wrapping `api/` functions | Business logic, data transformation |
| `pages/*.view-model.ts` | ALL logic — state, derived data, callbacks, side effects | JSX, rendering, CSS |
| `pages/*.page.tsx` | Connects view model to components (glue only) | Logic, useState, useEffect, useMemo |
| `components/` | Renders props to JSX | Fetching, state, business logic |
| `stores/` | Client-only UI state (Zustand) | Server data (use TanStack Query instead) |

### How It Connects

```
Page (glue)  →  ViewModel (all logic)  →  Query hooks  →  API functions  →  Backend
     ↓
Components (dumb, just props)
```

### ViewModel Rules

- View model is a custom hook: `useXxxViewModel()`
- It calls query hooks, manages local state, computes derived data, defines callbacks
- Returns a flat object of everything the page needs
- The page destructures the view model and passes props to components
- **Testing targets the view model only** — no component rendering needed

### Example

```ts
// pages/invoices/invoices.view-model.ts
export function useInvoicesViewModel() {
  const [filters, setFilters] = useState<InvoiceFilters>({ status: 'all' });
  const { data, isLoading } = useInvoices(filters);
  const overdueCount = useMemo(
    () => data?.filter((i) => i.status === 'OVERDUE').length ?? 0,
    [data],
  );

  const handleMarkPaid = useCallback(async (id: string, amountCents: number) => {
    await recordPayment(id, amountCents);
  }, []);

  return { invoices: data ?? [], isLoading, overdueCount, filters, setFilters, handleMarkPaid };
}
```

```tsx
// pages/invoices/invoices.page.tsx
export function InvoicesPage() {
  const vm = useInvoicesViewModel();
  return <InvoiceTable invoices={vm.invoices} onMarkPaid={vm.handleMarkPaid} />;
}
```

## Component Rules

- Components are pure: same props → same output
- No `useState`, `useEffect`, `useMemo` in components (except for UI-only concerns like animation)
- No data fetching in components
- Props are explicitly typed, not spread from view model

## State Management

- **Server state** (fetched data): TanStack Query via `queries/` hooks
- **Client state** (UI-only): Zustand stores in `stores/`
- Never use `localStorage` directly — use Zustand with persistence middleware if needed
- Never use React Context for state management — use Zustand

## Styling

- Tailwind CSS 4 for all styling
- shadcn/ui for primitive components (in `components/ui/`)
- Use `cn()` from `lib/utils.ts` for conditional classes
- Use `class-variance-authority` for component variants

## API Client

- `api/client.ts` is the base fetch wrapper — handles auth headers (Clerk token), base URL, error parsing
- Each `api/*.api.ts` file exports plain async functions, one per endpoint
- API functions return typed data, throw on error
- Never call `fetch()` directly from components or view models
