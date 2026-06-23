import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useReportsViewModel } from "./reports.view-model";
import type { DashboardSummary } from "../../api/dashboard.api";
import type { InvoiceListItem } from "../../api/invoices.api";

let mockSummary: DashboardSummary | undefined;
let mockInvoices: InvoiceListItem[];
const refetchSummary = vi.fn();
const refetchInvoices = vi.fn();
const fetchNextPage = vi.fn();
const syncMutateAsync = vi.fn();

vi.mock("../../queries/use-dashboard", () => ({
  useDashboardSummary: () => ({
    data: mockSummary,
    isLoading: false,
    error: null,
    refetch: refetchSummary,
  }),
  useTriggerSync: () => ({ mutateAsync: syncMutateAsync, isPending: false }),
}));

vi.mock("../../queries/use-invoices", () => ({
  useInvoicesInfinite: () => ({
    data: {
      pages: [
        {
          data: mockInvoices,
          pagination: {
            limit: 100,
            total: mockInvoices.length,
            nextCursor: null,
            hasMore: false,
          },
        },
      ],
    },
    isLoading: false,
    error: null,
    refetch: refetchInvoices,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

vi.mock("../../lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", isLoading: false, hasMultiple: false }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/reports"]}>{children}</MemoryRouter>;
}

const SUMMARY: DashboardSummary = {
  outstanding: { totalCents: 0, count: 0 },
  recoveredThisMonth: { totalCents: 0, pctChangeVsLastMonth: 0 },
  avgDaysToPay: { currentDays: 0, previousDays: 0 },
  activeSequences: { count: 0 },
  aging: {
    current: { totalCents: 24_210_000, count: 142 },
    days1to30: { totalCents: 10_800_000, count: 64 },
    days31to60: { totalCents: 8_100_000, count: 42 },
    days61to90: { totalCents: 6_480_000, count: 28 },
    days90plus: { totalCents: 4_320_000, count: 15 },
  },
};

function invoice(over: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: "inv-1",
    invoiceNumber: "9022",
    status: "overdue",
    amountCents: 1_245_000,
    amountPaidCents: 0,
    balanceDueCents: 1_245_000,
    currency: "USD",
    daysOverdue: 94,
    dueDate: "2023-10-12T00:00:00.000Z",
    issuedDate: null,
    paymentLinkUrl: null,
    customer: { id: "cust-1", companyName: "Global Dynamics Inc." },
    sequenceRun: null,
    ...over,
  };
}

describe("useReportsViewModel", () => {
  beforeEach(() => {
    mockSummary = SUMMARY;
    mockInvoices = [invoice()];
    refetchSummary.mockReset();
    refetchInvoices.mockReset();
    fetchNextPage.mockReset();
    syncMutateAsync.mockReset();
  });

  it("builds aging segments with proportional widths", () => {
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    const seg = result.current.agingSegments;
    expect(seg).toHaveLength(5);
    expect(seg[0]).toMatchObject({ key: "current", amount: "$242,100.00", count: 142 });
    expect(seg.reduce((s, x) => s + x.widthPct, 0)).toBeCloseTo(100, 5);
  });

  it("maps invoices (flattened from cursor pages) to rows with badges", () => {
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    const row = result.current.rows[0];
    expect(row.customerName).toBe("Global Dynamics Inc.");
    expect(row.invoiceNumber).toBe("#9022");
    expect(row.amount).toBe("$12,450.00");
    expect(row.overdueLabel).toBe("94 days");
    expect(row.bucketLabel).toBe("90+ Days");
    expect(row.statusLabel).toBe("Overdue");
  });

  it("shows an em dash + Current bucket for a not-overdue invoice", () => {
    mockInvoices = [invoice({ daysOverdue: 0, status: "open", invoiceNumber: null })];
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    const row = result.current.rows[0];
    expect(row.overdueLabel).toBe("—");
    expect(row.bucketLabel).toBe("Current");
    expect(row.invoiceNumber).toBe("—");
  });

  it("defaults to due-date ascending (oldest first)", () => {
    mockInvoices = [
      invoice({ id: "late", dueDate: "2023-12-20T00:00:00.000Z", customer: { id: "c2", companyName: "Zeta" } }),
      invoice({ id: "early", dueDate: "2023-10-12T00:00:00.000Z", customer: { id: "c1", companyName: "Alpha" } }),
    ];
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    expect(result.current.sortValue).toBe("due_date:asc");
    expect(result.current.rows[0].customerName).toBe("Alpha");
    expect(result.current.rows[1].customerName).toBe("Zeta");
  });

  it("filters by due-date range", () => {
    mockInvoices = [
      invoice({ id: "a", dueDate: "2023-10-12T00:00:00.000Z", customer: { id: "c1", companyName: "October Co" } }),
      invoice({ id: "b", dueDate: "2023-12-20T00:00:00.000Z", customer: { id: "c2", companyName: "December Co" } }),
    ];
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    act(() => result.current.setDateRange({ start: "2023-11-01", end: null }));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].customerName).toBe("December Co");
  });

  it("filters by customer/invoice search", () => {
    mockInvoices = [
      invoice({ id: "a", customer: { id: "c1", companyName: "Acme Corp" } }),
      invoice({ id: "b", customer: { id: "c2", companyName: "Globex" } }),
    ];
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    act(() => result.current.setSearch("glob"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].customerName).toBe("Globex");
  });

  it("filters by status", () => {
    mockInvoices = [
      invoice({ id: "a", status: "overdue", customer: { id: "c1", companyName: "Over" } }),
      invoice({ id: "b", status: "paid", customer: { id: "c2", companyName: "Paid" } }),
    ];
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    act(() => result.current.setStatus("paid"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].customerName).toBe("Paid");
  });

  it("surfaces the sync message on success", async () => {
    syncMutateAsync.mockResolvedValue({ message: "Sync queued", jobId: "j1" });
    const { result } = renderHook(() => useReportsViewModel(), { wrapper });
    await act(async () => {
      await result.current.handleSyncNow();
    });
    expect(syncMutateAsync).toHaveBeenCalledWith("biz-1");
    expect(result.current.syncMessage).toBe("Sync queued");
  });
});
