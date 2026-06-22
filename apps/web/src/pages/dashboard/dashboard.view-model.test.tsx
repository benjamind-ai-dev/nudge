import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useDashboardViewModel } from "./dashboard.view-model";
import type {
  DashboardSummary,
  NeedsAttentionItem,
  RecentWinItem,
} from "../../api/dashboard.api";

// --- Mockable query state ---
let mockSummary: DashboardSummary | undefined;
let mockAttention: NeedsAttentionItem[];
let mockWins: RecentWinItem[];
const refetchSummary = vi.fn();
const refetchAttention = vi.fn();
const refetchWins = vi.fn();
const syncMutateAsync = vi.fn();

vi.mock("../../queries/use-dashboard", () => ({
  useDashboardSummary: () => ({
    data: mockSummary,
    isLoading: false,
    error: null,
    refetch: refetchSummary,
  }),
  useNeedsAttention: () => ({
    data: mockAttention,
    isLoading: false,
    error: null,
    refetch: refetchAttention,
  }),
  useRecentWins: () => ({
    data: mockWins,
    isLoading: false,
    error: null,
    refetch: refetchWins,
  }),
  useTriggerSync: () => ({
    mutateAsync: syncMutateAsync,
    isPending: false,
  }),
}));

vi.mock("../../lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({
    businessId: "biz-1",
    isLoading: false,
    hasMultiple: false,
  }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: { firstName: "Sandra" } }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/dashboard"]}>{children}</MemoryRouter>;
}

const SUMMARY: DashboardSummary = {
  outstanding: { totalCents: 4_720_000, count: 23 },
  recoveredThisMonth: { totalCents: 1_280_000, pctChangeVsLastMonth: 18 },
  avgDaysToPay: { currentDays: 28, previousDays: 41 },
  activeSequences: { count: 19 },
  aging: {
    current: { totalCents: 2_124_000, count: 12 },
    days1to30: { totalCents: 1_180_000, count: 6 },
    days31to60: { totalCents: 708_000, count: 3 },
    days61to90: { totalCents: 472_000, count: 1 },
    days90plus: { totalCents: 236_000, count: 1 },
  },
};

function attentionItem(over: Partial<NeedsAttentionItem> = {}): NeedsAttentionItem {
  return {
    id: "att-1",
    type: "client_replied",
    invoiceId: "inv-1",
    invoiceNumber: "9021",
    customerId: "cust-1",
    customerName: "Acme Corp",
    amountCents: 420_000,
    balanceDueCents: 420_000,
    daysOverdue: 12,
    occurredAt: "2026-06-20T10:00:00.000Z",
    summary: "Payment being processed manually.",
    ...over,
  };
}

describe("useDashboardViewModel", () => {
  beforeEach(() => {
    mockSummary = SUMMARY;
    mockAttention = [attentionItem()];
    mockWins = [];
    refetchSummary.mockReset();
    refetchAttention.mockReset();
    refetchWins.mockReset();
    syncMutateAsync.mockReset();
  });

  it("formats KPI values from the summary", () => {
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    expect(result.current.kpis).toEqual({
      outstanding: { value: "$47,200.00", count: 23 },
      recovered: { value: "$12,800.00", pctChange: 18 },
      avgDaysToPay: { current: 28, previous: 41 },
      activeSequences: 19,
    });
  });

  it("returns kpis as null until the summary loads", () => {
    mockSummary = undefined;
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    expect(result.current.kpis).toBeNull();
  });

  it("computes aging segment widths proportional to bucket totals", () => {
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    const segments = result.current.agingSegments;
    expect(segments).toHaveLength(5);
    const totalWidth = segments.reduce((s, seg) => s + seg.widthPct, 0);
    expect(totalWidth).toBeCloseTo(100, 5);
    expect(segments[0]).toMatchObject({ label: "Current", amount: "$21,240.00", count: 12 });
  });

  it("returns zero widths when there is no aging balance", () => {
    mockSummary = {
      ...SUMMARY,
      aging: {
        current: { totalCents: 0, count: 0 },
        days1to30: { totalCents: 0, count: 0 },
        days31to60: { totalCents: 0, count: 0 },
        days61to90: { totalCents: 0, count: 0 },
        days90plus: { totalCents: 0, count: 0 },
      },
    };
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    expect(result.current.agingSegments.every((s) => s.widthPct === 0)).toBe(true);
  });

  it("maps attention items to rows with badge + formatted amount", () => {
    mockAttention = [
      attentionItem({ type: "disputed", invoiceNumber: "8832", amountCents: 1_200_000 }),
    ];
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    const row = result.current.attentionRows[0];
    expect(row.badge.label).toBe("Disputed");
    expect(row.amount).toBe("$12,000.00");
    expect(row.invoiceNumber).toBe("#8832");
  });

  it("falls back to an em dash when an attention item has no invoice number", () => {
    mockAttention = [attentionItem({ invoiceNumber: null })];
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    expect(result.current.attentionRows[0].invoiceNumber).toBe("—");
  });

  it("maps recent wins with a positive signed amount", () => {
    mockWins = [
      {
        id: "win-1",
        invoiceId: "inv-9",
        invoiceNumber: "8921",
        customerId: "cust-9",
        customerName: "Wayne Ent.",
        amountCents: 1_240_000,
        paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });
    const win = result.current.winRows[0];
    expect(win.amount).toBe("+$12,400.00");
    expect(win.description).toContain("#8921");
    expect(win.relativeTime).toBe("2 hours ago");
  });

  it("surfaces the sync message on success", async () => {
    syncMutateAsync.mockResolvedValue({ message: "Sync started.", jobId: "job-1" });
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });

    await act(async () => {
      await result.current.handleSyncNow();
    });

    expect(syncMutateAsync).toHaveBeenCalledWith("biz-1");
    await waitFor(() => expect(result.current.syncMessage).toBe("Sync started."));
    expect(result.current.syncError).toBeNull();
  });

  it("surfaces an error message when sync fails", async () => {
    syncMutateAsync.mockRejectedValue(new Error("Too many requests"));
    const { result } = renderHook(() => useDashboardViewModel(), { wrapper });

    await act(async () => {
      await result.current.handleSyncNow();
    });

    await waitFor(() => expect(result.current.syncError).toBe("Too many requests"));
    expect(result.current.syncMessage).toBeNull();
  });
});
