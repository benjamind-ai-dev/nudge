import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useGetPaidViewModel, PAGE_SIZE } from "./get-paid.view-model";
import type { InvoiceListItem } from "../../api/invoices.api";

// ---- Mock state -----------------------------------------------------------
let mockInvoices: InvoiceListItem[] = [];
let mockIsLoading = false;
let mockError: unknown = null;
const refetchMock = vi.fn();
const fetchNextPageMock = vi.fn();
const startFollowUpMutateAsync = vi.fn();
const navigateMock = vi.fn();
let startFollowUpIsPending = false;

vi.mock("../../queries/use-invoices", () => ({
  useInvoicesInfinite: () => ({
    data: { pages: [{ data: mockInvoices, pagination: { nextCursor: null, hasMore: false } }] },
    fetchNextPage: fetchNextPageMock,
    hasNextPage: false,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: refetchMock,
    isFetchingNextPage: false,
  }),
}));

vi.mock("../../queries/use-overdue-invoices", () => ({
  useStartFollowUp: () => ({
    mutateAsync: startFollowUpMutateAsync,
    isPending: startFollowUpIsPending,
  }),
}));

vi.mock("../../lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({
    businessId: "biz-test",
    isLoading: false,
    hasMultiple: false,
  }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/get-paid"]}>{children}</MemoryRouter>;
}

// ---- Fixtures -------------------------------------------------------------
function makeInvoice(over: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: "inv-1",
    invoiceNumber: "1001",
    status: "overdue",
    amountCents: 500_000,
    amountPaidCents: 0,
    balanceDueCents: 500_000,
    currency: "USD",
    daysOverdue: 15,
    dueDate: "2026-06-01T00:00:00.000Z",
    issuedDate: "2026-05-01T00:00:00.000Z",
    paymentLinkUrl: "https://pay.example.com/inv-1",
    customer: { id: "cust-1", companyName: "Acme Corp" },
    sequenceRun: null,
    ...over,
  };
}

/** Build N unique invoices with distinct IDs for pagination tests. */
function makeInvoices(count: number): InvoiceListItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeInvoice({ id: `inv-${i + 1}`, invoiceNumber: String(1000 + i), balanceDueCents: 100_000 }),
  );
}

// ---- Tests ----------------------------------------------------------------
describe("useGetPaidViewModel", () => {
  beforeEach(() => {
    mockInvoices = [];
    mockIsLoading = false;
    mockError = null;
    startFollowUpIsPending = false;
    refetchMock.mockReset();
    fetchNextPageMock.mockReset();
    startFollowUpMutateAsync.mockReset();
    navigateMock.mockReset();
  });

  // 1. Overdue rows mapped + sorted desc by balance
  it("maps invoices to rows sorted by balanceDue descending", () => {
    mockInvoices = [
      makeInvoice({ id: "inv-1", balanceDueCents: 200_000, invoiceNumber: "1001" }),
      makeInvoice({ id: "inv-2", balanceDueCents: 500_000, invoiceNumber: "1002" }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows).toHaveLength(2);
    // sorted desc — higher amount first
    expect(result.current.rows[0].id).toBe("inv-2");
    expect(result.current.rows[1].id).toBe("inv-1");
  });

  // 2. Money: formatDollars — no decimals (123456 cents → "$1,235" due to rounding)
  it("formats balanceDue with formatDollars — no decimal places", () => {
    mockInvoices = [makeInvoice({ balanceDueCents: 123_456 })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    // 123456 cents = $1234.56, maximumFractionDigits:0 rounds to $1,235
    expect(result.current.rows[0].balanceDue).toBe("$1,235");
  });

  // 3. Round-number dollars format correctly
  it("formats a round dollar amount with no decimals", () => {
    mockInvoices = [makeInvoice({ balanceDueCents: 500_000 })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows[0].balanceDue).toBe("$5,000");
  });

  // 4. Status derivation — none (null sequenceRun)
  it("derives followUpStatus 'none' when sequenceRun is null", () => {
    mockInvoices = [makeInvoice({ sequenceRun: null })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows[0].followUpStatus).toBe("none");
  });

  // 5. Action list: invoices with an ACTIVE sequence are excluded
  it("excludes invoices that already have an active sequence", () => {
    mockInvoices = [
      makeInvoice({ id: "no-seq", sequenceRun: null }),
      makeInvoice({ id: "active", sequenceRun: { id: "run-1", status: "active" } }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows.map((r) => r.id)).toEqual(["no-seq"]);
  });

  // 6. Action list: invoices with a PAUSED sequence are excluded
  it("excludes invoices that already have a paused sequence", () => {
    mockInvoices = [
      makeInvoice({ id: "no-seq", sequenceRun: null }),
      makeInvoice({ id: "paused", sequenceRun: { id: "run-2", status: "paused" } }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows.map((r) => r.id)).toEqual(["no-seq"]);
  });

  // 7. Unexpected sequenceRun status falls back to 'none'
  it("falls back to 'none' for an unrecognised sequenceRun status", () => {
    mockInvoices = [makeInvoice({ sequenceRun: { id: "run-3", status: "completed" } })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows[0].followUpStatus).toBe("none");
  });

  // 8. Invoice number formatting
  it("prefixes invoice number with # and falls back to em dash when null", () => {
    mockInvoices = [
      makeInvoice({ id: "inv-a", invoiceNumber: "5050" }),
      makeInvoice({ id: "inv-b", invoiceNumber: null }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    const ids = result.current.rows.map((r) => r.id);
    const rowA = result.current.rows[ids.indexOf("inv-a")];
    const rowB = result.current.rows[ids.indexOf("inv-b")];
    expect(rowA.invoiceNumber).toBe("#5050");
    expect(rowB.invoiceNumber).toBe("—");
  });

  // 9. Loading passthrough
  it("passes isLoading through", () => {
    mockIsLoading = true;
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toHaveLength(0);
  });

  // 10. Error passthrough
  it("passes error through", () => {
    mockError = new Error("Network error");
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.error).toBeInstanceOf(Error);
  });

  // 11. openDialog populates dialog fields
  it("openDialog sets dialogInvoiceId, number, customer name, and amount", () => {
    mockInvoices = [makeInvoice({ id: "inv-x", invoiceNumber: "9999", balanceDueCents: 500_000 })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => {
      result.current.openDialog(result.current.rows[0]);
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.dialogInvoiceId).toBe("inv-x");
    expect(result.current.dialogInvoiceNumber).toBe("#9999");
    expect(result.current.dialogCustomerName).toBe("Acme Corp");
    expect(result.current.dialogAmount).toBe("$5,000");
  });

  // 11b. openDialog initialises editable dialog fields with defaults
  it("openDialog initialises subject, body, and checkbox defaults", () => {
    mockInvoices = [makeInvoice({ id: "inv-x", invoiceNumber: "9999", balanceDueCents: 500_000 })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));

    expect(result.current.dialogSubject).toContain("#9999");
    expect(result.current.dialogSubject).toContain("past due");
    expect(result.current.dialogBody).toContain("Acme Corp");
    expect(result.current.dialogBody).toContain("#9999");
    expect(result.current.dialogIncludePaymentLink).toBe(true);
    expect(result.current.dialogSendByEmail).toBe(true);
  });

  // 11c. setDialogSubject and setDialogBody update state
  it("setDialogSubject and setDialogBody update their respective state", () => {
    mockInvoices = [makeInvoice()];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));
    act(() => result.current.setDialogSubject("Custom subject"));
    act(() => result.current.setDialogBody("Custom body text"));

    expect(result.current.dialogSubject).toBe("Custom subject");
    expect(result.current.dialogBody).toBe("Custom body text");
  });

  // 11d. toggleIncludePaymentLink and toggleSendByEmail flip their flags
  it("toggleIncludePaymentLink and toggleSendByEmail flip their boolean state", () => {
    mockInvoices = [makeInvoice()];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));
    expect(result.current.dialogIncludePaymentLink).toBe(true);
    expect(result.current.dialogSendByEmail).toBe(true);

    act(() => result.current.toggleIncludePaymentLink());
    act(() => result.current.toggleSendByEmail());

    expect(result.current.dialogIncludePaymentLink).toBe(false);
    expect(result.current.dialogSendByEmail).toBe(false);
  });

  // 11e. handleStartFollowUp passes sendByEmail:false when toggled off
  it("handleStartFollowUp passes sendByEmail:false when toggled off", async () => {
    startFollowUpMutateAsync.mockResolvedValue({
      data: { runId: "run-new", created: true, status: "active" },
    });
    mockInvoices = [makeInvoice({ id: "inv-toggle" })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));
    act(() => result.current.toggleSendByEmail());

    await act(async () => {
      await result.current.handleStartFollowUp();
    });

    expect(startFollowUpMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ sendByEmail: false }),
      }),
    );
  });

  // 11f. openDialog re-inits fields on second open (no stale state)
  it("openDialog re-inits editable fields when opened for a different invoice", () => {
    mockInvoices = [
      makeInvoice({ id: "inv-a", invoiceNumber: "1111" }),
      makeInvoice({ id: "inv-b", invoiceNumber: "2222" }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));
    act(() => result.current.setDialogSubject("Stale subject"));
    act(() => result.current.closeDialog());

    act(() => result.current.openDialog(result.current.rows[1]));
    // The second dialog should contain the second invoice number
    expect(result.current.dialogSubject).toContain("#");
    expect(result.current.dialogSubject).not.toContain("Stale subject");
  });

  // 12. closeDialog resets state
  it("closeDialog resets dialog state", () => {
    mockInvoices = [makeInvoice()];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));
    expect(result.current.isDialogOpen).toBe(true);

    act(() => result.current.closeDialog());
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.dialogInvoiceId).toBeNull();
  });

  // 13. handleStartFollowUp calls mutation with correct args (incl. body fields)
  it("handleStartFollowUp calls mutateAsync with invoiceId + businessId + body fields", async () => {
    startFollowUpMutateAsync.mockResolvedValue({
      data: { runId: "run-new", created: true, status: "active" },
    });
    mockInvoices = [makeInvoice({ id: "inv-z" })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));

    await act(async () => {
      await result.current.handleStartFollowUp();
    });

    expect(startFollowUpMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-z",
        businessId: "biz-test",
        body: expect.objectContaining({
          subject: expect.stringContaining("#1001"),
          body: expect.stringContaining("Acme Corp"),
          includePaymentLink: true,
          sendByEmail: true,
        }),
      }),
    );
    await waitFor(() => expect(result.current.isDialogOpen).toBe(false));
  });

  // 14. already_running closes dialog and sets alreadyRunning flag
  it("handles already_running response gracefully — closes dialog and flags it", async () => {
    startFollowUpMutateAsync.mockResolvedValue({
      data: { runId: null, created: false, status: "already_running" },
    });
    mockInvoices = [makeInvoice({ id: "inv-dup" })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));

    await act(async () => {
      await result.current.handleStartFollowUp();
    });

    await waitFor(() => {
      expect(result.current.isDialogOpen).toBe(false);
      expect(result.current.alreadyRunning).toBe(true);
    });
    expect(result.current.startError).toBeNull();
  });

  // 15. mutation error surfaces in startError
  it("surfaces mutation error in startError", async () => {
    startFollowUpMutateAsync.mockRejectedValue(new Error("Server error"));
    mockInvoices = [makeInvoice({ id: "inv-err" })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.openDialog(result.current.rows[0]));

    await act(async () => {
      await result.current.handleStartFollowUp();
    });

    await waitFor(() =>
      expect(result.current.startError).toBe("Server error"),
    );
    expect(result.current.isDialogOpen).toBe(true); // stays open on error
  });

  // 16. toggleExpand opens and closes a row
  it("toggleExpand sets expandedId and toggling again collapses it", () => {
    mockInvoices = [makeInvoice({ id: "inv-expand" })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.toggleExpand("inv-expand"));
    expect(result.current.expandedId).toBe("inv-expand");

    act(() => result.current.toggleExpand("inv-expand"));
    expect(result.current.expandedId).toBeNull();
  });

  // 17. agingDotColor assigned per days overdue bucket
  it("assigns the correct aging dot colour per overdue bucket", () => {
    mockInvoices = [
      makeInvoice({ id: "a", daysOverdue: 10 }),   // 1–30: #FBBF24
      makeInvoice({ id: "b", daysOverdue: 45 }),   // 31–60: #FB923C
      makeInvoice({ id: "c", daysOverdue: 75 }),   // 61–90: #EF4444
      makeInvoice({ id: "d", daysOverdue: 100 }),  // 90+:   #7F1D1D
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    const byId = Object.fromEntries(result.current.rows.map((r) => [r.id, r]));
    expect(byId["a"].agingDotColor).toBe("#FBBF24");
    expect(byId["b"].agingDotColor).toBe("#FB923C");
    expect(byId["c"].agingDotColor).toBe("#EF4444");
    expect(byId["d"].agingDotColor).toBe("#7F1D1D");
  });

  // 17b. agingLabel is "—" for non-overdue rows (daysOverdue <= 0)
  it("agingLabel is '—' for invoices that are not yet overdue", () => {
    mockInvoices = [
      makeInvoice({ id: "on-time", daysOverdue: 0, status: "open" }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows[0].agingLabel).toBe("—");
  });

  // 17c. agingLabel shows days for overdue rows
  it("agingLabel shows N days for overdue rows", () => {
    mockInvoices = [makeInvoice({ id: "late", daysOverdue: 15 })];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows[0].agingLabel).toBe("15 days");
  });

  // 18. isSevere flag set for daysOverdue >= 90
  it("marks rows with daysOverdue >= 90 as isSevere", () => {
    mockInvoices = [
      makeInvoice({ id: "s1", daysOverdue: 89 }),
      makeInvoice({ id: "s2", daysOverdue: 90 }),
      makeInvoice({ id: "s3", daysOverdue: 120 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    const byId = Object.fromEntries(result.current.rows.map((r) => [r.id, r]));
    expect(byId["s1"].isSevere).toBe(false);
    expect(byId["s2"].isSevere).toBe(true);
    expect(byId["s3"].isSevere).toBe(true);
  });

  // 19. Pagination — page 1 returns first PAGE_SIZE rows
  it("returns first PAGE_SIZE rows on page 1", () => {
    mockInvoices = makeInvoices(PAGE_SIZE + 3);
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.rows).toHaveLength(PAGE_SIZE);
    expect(result.current.total).toBe(PAGE_SIZE + 3);
    expect(result.current.totalPages).toBe(2);
  });

  // 20. Pagination — setPage advances to page 2
  it("setPage(2) returns the second slice", () => {
    mockInvoices = makeInvoices(PAGE_SIZE + 3);
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.rows).toHaveLength(3);
  });

  // 21. Pagination — setPage clamps below 1
  it("setPage clamps to 1 when given 0", () => {
    mockInvoices = makeInvoices(5);
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
  });

  // 22. Pagination — setPage clamps above totalPages
  it("setPage clamps to totalPages when given a value beyond range", () => {
    mockInvoices = makeInvoices(5);
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setPage(999));
    expect(result.current.page).toBe(1); // only 1 page for 5 items
  });

  // 23. totalPages is 1 when there are no invoices
  it("totalPages is 1 when invoices list is empty", () => {
    mockInvoices = [];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.total).toBe(0);
  });

  // 24. Hero total / count derivation
  it("computes totalOverdueCents and overdueCount over all loaded rows", () => {
    mockInvoices = [
      makeInvoice({ id: "t1", balanceDueCents: 10_000 }),
      makeInvoice({ id: "t2", balanceDueCents: 20_000 }),
      makeInvoice({ id: "t3", balanceDueCents: 30_000 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.totalOverdueCents).toBe(60_000);
    expect(result.current.overdueCount).toBe(3);
  });

  // 25. onViewSequence navigates to /sequences
  it("onViewSequence calls navigate('/sequences')", () => {
    mockInvoices = [makeInvoice()];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.onViewSequence());

    expect(navigateMock).toHaveBeenCalledWith("/sequences");
  });

  // 26. Default status filter is "unpaid" — open, overdue, partial included; paid excluded
  it("default filter is 'unpaid': includes open, overdue, partial — excludes paid", () => {
    mockInvoices = [
      makeInvoice({ id: "overdue", status: "overdue", daysOverdue: 10 }),
      makeInvoice({ id: "open", status: "open", daysOverdue: 0 }),
      makeInvoice({ id: "partial", status: "partial", daysOverdue: 5 }),
      makeInvoice({ id: "paid", status: "paid", daysOverdue: 0 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    expect(result.current.statusFilter).toBe("unpaid");
    const ids = result.current.rows.map((r) => r.id);
    expect(ids).toContain("overdue");
    expect(ids).toContain("open");
    expect(ids).toContain("partial");
    expect(ids).not.toContain("paid");
  });

  // 27. Switching filter to "overdue" narrows to only overdue invoices
  it("switching to 'overdue' filter shows only overdue invoices", () => {
    mockInvoices = [
      makeInvoice({ id: "overdue", status: "overdue", daysOverdue: 10 }),
      makeInvoice({ id: "open", status: "open", daysOverdue: 0 }),
      makeInvoice({ id: "partial", status: "partial", daysOverdue: 5 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setStatusFilter("overdue"));

    const ids = result.current.rows.map((r) => r.id);
    expect(ids).toEqual(["overdue"]);
  });

  // 28. Switching filter to "open" shows only open invoices
  it("switching to 'open' filter shows only open invoices", () => {
    mockInvoices = [
      makeInvoice({ id: "overdue", status: "overdue", daysOverdue: 10 }),
      makeInvoice({ id: "open", status: "open", daysOverdue: 0 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setStatusFilter("open"));

    const ids = result.current.rows.map((r) => r.id);
    expect(ids).toEqual(["open"]);
  });

  // 29. Switching filter to "partial" shows only partial invoices
  it("switching to 'partial' filter shows only partial invoices", () => {
    mockInvoices = [
      makeInvoice({ id: "overdue", status: "overdue", daysOverdue: 10 }),
      makeInvoice({ id: "partial", status: "partial", daysOverdue: 5 }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setStatusFilter("partial"));

    const ids = result.current.rows.map((r) => r.id);
    expect(ids).toEqual(["partial"]);
  });

  // 30. No-sequence constraint still applies when filter changes
  it("active/paused sequences are still excluded when filter changes", () => {
    mockInvoices = [
      makeInvoice({ id: "no-seq-overdue", status: "overdue", sequenceRun: null }),
      makeInvoice({ id: "active-seq-overdue", status: "overdue", sequenceRun: { id: "r1", status: "active" } }),
      makeInvoice({ id: "paused-seq-overdue", status: "overdue", sequenceRun: { id: "r2", status: "paused" } }),
    ];
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setStatusFilter("overdue"));

    const ids = result.current.rows.map((r) => r.id);
    expect(ids).toEqual(["no-seq-overdue"]);
  });

  // 31. setStatusFilter resets page to 1
  it("setStatusFilter resets page to 1", () => {
    mockInvoices = makeInvoices(PAGE_SIZE + 3);
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setStatusFilter("overdue"));
    expect(result.current.page).toBe(1);
  });

  // 32. statusOptions exposed with all 4 options
  it("exposes 4 status options (unpaid, overdue, open, partial)", () => {
    const { result } = renderHook(() => useGetPaidViewModel(), { wrapper });
    const values = result.current.statusOptions.map((o) => o.value);
    expect(values).toEqual(["unpaid", "overdue", "open", "partial"]);
  });
});
