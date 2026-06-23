import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { formatDollars } from "../../lib/format";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useInvoicesInfinite } from "../../queries/use-invoices";
import { useStartFollowUp } from "../../queries/use-overdue-invoices";
import type { InvoiceListItem } from "../../api/invoices.api";
import type { DateRange } from "../../components/date-range-picker";

export const PAGE_SIZE = 10;

// ---- Status filter ---------------------------------------------------------
export type StatusFilter = "unpaid" | "overdue" | "open" | "partial";

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
];

function matchesStatusFilter(item: InvoiceListItem, filter: string): boolean {
  switch (filter) {
    case "unpaid":
      return item.status === "open" || item.status === "overdue" || item.status === "partial";
    case "overdue":
      return item.status === "overdue";
    case "open":
      return item.status === "open";
    case "partial":
      return item.status === "partial";
    default:
      return true;
  }
}

// ---- Sort options -----------------------------------------------------------
interface SortDef {
  value: string;
  label: string;
  compare: (a: InvoiceListItem, b: InvoiceListItem) => number;
}

export const SORT_OPTIONS: SortDef[] = [
  {
    value: "amount_cents:desc",
    label: "Amount (high to low)",
    compare: (a, b) => b.amountCents - a.amountCents,
  },
  {
    value: "due_date:asc",
    label: "Due date (oldest first)",
    compare: (a, b) => a.dueDate.localeCompare(b.dueDate),
  },
  {
    value: "days_overdue:desc",
    label: "Most overdue",
    compare: (a, b) => b.daysOverdue - a.daysOverdue,
  },
];

const DEFAULT_SORT = "amount_cents:desc";

// ---- Aging dot colours per spec --------------------------------------------
function agingDotColor(daysOverdue: number): string {
  if (daysOverdue <= 0) return "#94A3B8"; // muted slate for on-time
  if (daysOverdue <= 30) return "#FBBF24"; // 1–30
  if (daysOverdue <= 60) return "#FB923C"; // 31–60
  if (daysOverdue <= 90) return "#EF4444"; // 61–90
  return "#7F1D1D"; // 90+
}

// ---- Follow-up status derived from sequenceRun ----------------------------
export type FollowUpStatus = "none" | "active" | "paused";

function followUpStatus(item: InvoiceListItem): FollowUpStatus {
  if (!item.sequenceRun) return "none";
  if (item.sequenceRun.status === "active") return "active";
  if (item.sequenceRun.status === "paused") return "paused";
  return "none";
}

// ---- Short date: "May 21" (month + day, no year) ---------------------------
function formatMonthDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

// ---- Exported row shape ----------------------------------------------------
export interface OverdueRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issuedDate: string | null; // formatted (year+month+day)
  dueDate: string;           // formatted (year+month+day)
  dueDateShort: string;      // "May 21" — used for the combined Customer & Invoice subline
  daysOverdue: number;
  balanceDueCents: number;   // raw cents for urgency total
  balanceDue: string;        // formatDollars — no decimals
  paymentLinkUrl: string | null;
  agingDotColor: string;
  agingLabel: string;        // "15 days" for overdue, "—" for on-time
  followUpStatus: FollowUpStatus;
  sequenceRunId: string | null;
  isSevere: boolean;         // daysOverdue >= 90 → faint red row tint
}

function toRow(item: InvoiceListItem): OverdueRow {
  const isOverdue = item.daysOverdue > 0;
  return {
    id: item.id,
    invoiceNumber: item.invoiceNumber ? `#${item.invoiceNumber}` : "—",
    customerName: item.customer.companyName,
    issuedDate: item.issuedDate ? formatShortDate(item.issuedDate) : null,
    dueDate: formatShortDate(item.dueDate),
    dueDateShort: formatMonthDay(item.dueDate),
    daysOverdue: item.daysOverdue,
    balanceDueCents: item.balanceDueCents,
    balanceDue: formatDollars(item.balanceDueCents),
    paymentLinkUrl: item.paymentLinkUrl,
    agingDotColor: agingDotColor(item.daysOverdue),
    agingLabel: isOverdue ? `${item.daysOverdue} days` : "—",
    followUpStatus: followUpStatus(item),
    sequenceRunId: item.sequenceRun?.id ?? null,
    isSevere: item.daysOverdue >= 90,
  };
}

// ---- View model ------------------------------------------------------------
export interface GetPaidViewModel {
  // Paginated rows (current page slice)
  rows: OverdueRow[];
  // All rows (full loaded set after filter + no-sequence constraint)
  allRows: OverdueRow[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;

  // Filter bar
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  statusOptions: { value: string; label: string }[];
  sortValue: string;
  sortOptions: { value: string; label: string }[];
  setSort: (v: string) => void;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  setPage: (p: number) => void;

  // Hero totals (reflect current filtered set)
  totalOverdueCents: number;
  overdueCount: number;

  // Expanded row
  expandedId: string | null;
  toggleExpand: (id: string) => void;

  // Dialog
  dialogInvoiceId: string | null;
  dialogInvoiceNumber: string;
  dialogCustomerName: string;
  dialogAmount: string;
  isDialogOpen: boolean;
  openDialog: (row: OverdueRow) => void;
  closeDialog: () => void;
  handleStartFollowUp: () => Promise<void>;
  isStarting: boolean;
  startError: string | null;
  alreadyRunning: boolean;

  // Dialog editable fields
  dialogSubject: string;
  dialogBody: string;
  dialogIncludePaymentLink: boolean;
  dialogSendByEmail: boolean;
  setDialogSubject: (v: string) => void;
  setDialogBody: (v: string) => void;
  toggleIncludePaymentLink: () => void;
  toggleSendByEmail: () => void;

  // Navigation — wires the dead "View sequence" / "Resume" buttons.
  // Deep-linking to the specific sequence run is a follow-up TODO.
  onViewSequence: () => void;
}

export function useGetPaidViewModel(): GetPaidViewModel {
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();
  const invoicesQuery = useInvoicesInfinite(businessId);
  const startFollowUpMutation = useStartFollowUp();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = invoicesQuery;

  // Pull every page so we can filter/paginate the full set locally.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Filter bar state
  const [dateRange, setDateRangeState] = useState<DateRange>({ start: null, end: null });
  const [search, setSearchState] = useState("");
  const [statusFilter, setStatusFilterState] = useState<string>("unpaid");
  const [sortValue, setSortState] = useState(DEFAULT_SORT);

  // Other state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogInvoiceId, setDialogInvoiceId] = useState<string | null>(null);
  const [dialogInvoiceNumber, setDialogInvoiceNumber] = useState("");
  const [dialogCustomerName, setDialogCustomerName] = useState("");
  const [dialogAmount, setDialogAmount] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [alreadyRunning, setAlreadyRunning] = useState(false);
  const [page, setPageState] = useState(1);

  // Editable dialog fields
  const [dialogSubject, setDialogSubject] = useState("");
  const [dialogBody, setDialogBody] = useState("");
  const [dialogIncludePaymentLink, setDialogIncludePaymentLink] = useState(true);
  const [dialogSendByEmail, setDialogSendByEmail] = useState(true);

  const allItems = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data),
    [data],
  );

  const resetPage = () => setPageState(1);

  // Get Paid is the action list: only invoices with no active/paused sequence,
  // matching status filter, date range (on dueDate), and search (customer/invoice #).
  const allRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sortDef = SORT_OPTIONS.find((s) => s.value === sortValue) ?? SORT_OPTIONS[0];

    const filtered = allItems.filter((item) => {
      // No-sequence constraint (core Get Paid rule)
      if (followUpStatus(item) !== "none") return false;

      // Status filter
      if (!matchesStatusFilter(item, statusFilter)) return false;

      // Date range filter (on dueDate ISO string)
      const day = item.dueDate.slice(0, 10);
      if (dateRange.start && day < dateRange.start) return false;
      if (dateRange.end && day > dateRange.end) return false;

      // Search filter (customer name or invoice #)
      if (q) {
        const num = (item.invoiceNumber ?? "").toLowerCase();
        const name = item.customer.companyName.toLowerCase();
        if (!num.includes(q) && !name.includes(q)) return false;
      }

      return true;
    });

    // Sort raw InvoiceListItems (comparator operates on InvoiceListItem), then map to rows.
    return [...filtered].sort(sortDef.compare).map(toRow);
  }, [allItems, statusFilter, dateRange, search, sortValue]);

  // Client-side pagination — clamp page when data changes
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = useMemo(
    () => allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [allRows, safePage],
  );

  // Hero totals — summed over the full filtered set.
  const totalOverdueCents = useMemo(
    () => allRows.reduce((sum, r) => sum + r.balanceDueCents, 0),
    [allRows],
  );
  const overdueCount = allRows.length;

  // Filter setters — each resets page to 1
  const setDateRange = useCallback((r: DateRange) => {
    setDateRangeState(r);
    resetPage();
  }, []);

  const setSearch = useCallback((v: string) => {
    setSearchState(v);
    resetPage();
  }, []);

  const setStatusFilter = useCallback((f: string) => {
    setStatusFilterState(f);
    resetPage();
  }, []);

  const setSort = useCallback((v: string) => {
    setSortState(v);
    resetPage();
  }, []);

  const setPage = useCallback(
    (p: number) => {
      setPageState(Math.max(1, Math.min(p, totalPages)));
    },
    [totalPages],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const openDialog = useCallback((row: OverdueRow) => {
    setDialogInvoiceId(row.id);
    setDialogInvoiceNumber(row.invoiceNumber);
    setDialogCustomerName(row.customerName);
    setDialogAmount(row.balanceDue);
    setStartError(null);
    setAlreadyRunning(false);

    // Initialise editable fields from the selected row
    setDialogSubject(`Reminder: invoice ${row.invoiceNumber} is past due`);
    setDialogBody(
      `Hi ${row.customerName} team,\n\nThis is a friendly reminder that invoice ${row.invoiceNumber} for ${row.balanceDue} is currently past due. We'd appreciate it if you could process this payment at your earliest convenience.\n\nIf you've already sent payment, please disregard this message.\n\nBest regards,\nNudge Billing`,
    );
    setDialogIncludePaymentLink(true);
    setDialogSendByEmail(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogInvoiceId(null);
    setStartError(null);
    // Note: alreadyRunning is NOT reset here — it stays set so the page can
    // show an inline notice after the dialog closes. It resets when openDialog
    // is called again for a new invoice.
  }, []);

  const handleStartFollowUp = useCallback(async () => {
    if (!dialogInvoiceId || !businessId) return;
    setStartError(null);
    setAlreadyRunning(false);
    try {
      const result = await startFollowUpMutation.mutateAsync({
        invoiceId: dialogInvoiceId,
        businessId,
        body: {
          subject: dialogSubject,
          body: dialogBody,
          includePaymentLink: dialogIncludePaymentLink,
          sendByEmail: dialogSendByEmail,
        },
      });
      if (result.data.status === "already_running") {
        setAlreadyRunning(true);
        // Still close — the row already shows Active
        closeDialog();
      } else {
        closeDialog();
      }
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Couldn't start follow-up.");
    }
  }, [
    dialogInvoiceId,
    businessId,
    startFollowUpMutation,
    closeDialog,
    dialogSubject,
    dialogBody,
    dialogIncludePaymentLink,
    dialogSendByEmail,
  ]);

  const toggleIncludePaymentLink = useCallback(() => {
    setDialogIncludePaymentLink((prev) => !prev);
  }, []);

  const toggleSendByEmail = useCallback(() => {
    setDialogSendByEmail((prev) => !prev);
  }, []);

  // Deep-linking to a specific sequence run is a follow-up TODO.
  const onViewSequence = useCallback(() => {
    void navigate("/sequences");
  }, [navigate]);

  return {
    rows,
    allRows,
    isLoading: businessLoading || isLoading,
    error,
    refetch,

    // Filter bar
    dateRange,
    setDateRange,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusOptions: STATUS_OPTIONS,
    sortValue,
    sortOptions: SORT_OPTIONS.map(({ value, label }) => ({ value, label })),
    setSort,

    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
    total,
    setPage,

    totalOverdueCents,
    overdueCount,

    expandedId,
    toggleExpand,

    dialogInvoiceId,
    dialogInvoiceNumber,
    dialogCustomerName,
    dialogAmount,
    isDialogOpen: dialogInvoiceId !== null,
    openDialog,
    closeDialog,
    handleStartFollowUp,
    isStarting: startFollowUpMutation.isPending,
    startError,
    alreadyRunning,

    dialogSubject,
    dialogBody,
    dialogIncludePaymentLink,
    dialogSendByEmail,
    setDialogSubject,
    setDialogBody,
    toggleIncludePaymentLink,
    toggleSendByEmail,

    onViewSequence,
  };
}
