import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCents } from "../../lib/format";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useDashboardSummary, useTriggerSync } from "../../queries/use-dashboard";
import { useInvoicesInfinite } from "../../queries/use-invoices";
import type { DateRange } from "../../components/date-range-picker";
import type { AgingBuckets } from "../../api/dashboard.api";
import type { InvoiceListItem, InvoiceStatus } from "../../api/invoices.api";

const PAGE_SIZE = 10;

type BucketKey =
  | "current"
  | "days1to30"
  | "days31to60"
  | "days61to90"
  | "days90plus";

const BUCKET_META: Record<
  BucketKey,
  { label: string; color: string; badgeClass: string }
> = {
  current: { label: "Current", color: "#10B981", badgeClass: "bg-emerald-500/15 text-emerald-300" },
  days1to30: { label: "1–30 Days", color: "#FBBF24", badgeClass: "bg-amber-500/15 text-amber-300" },
  days31to60: { label: "31–60 Days", color: "#FB923C", badgeClass: "bg-orange-500/15 text-orange-300" },
  days61to90: { label: "61–90 Days", color: "#EF4444", badgeClass: "bg-red-500/15 text-red-300" },
  days90plus: { label: "90+ Days", color: "#7F1D1D", badgeClass: "bg-red-500/20 text-red-300" },
};

const BUCKET_ORDER: BucketKey[] = [
  "current",
  "days1to30",
  "days31to60",
  "days61to90",
  "days90plus",
];

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  overdue: "bg-red-500/15 text-red-300",
  partial: "bg-amber-500/15 text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  disputed: "bg-fuchsia-500/15 text-fuchsia-300",
  open: "bg-slate-500/15 text-slate-300",
  voided: "bg-slate-500/10 text-slate-400",
};

function bucketOf(daysOverdue: number): BucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "days1to30";
  if (daysOverdue <= 60) return "days31to60";
  if (daysOverdue <= 90) return "days61to90";
  return "days90plus";
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export interface AgingSegment {
  key: BucketKey;
  label: string;
  color: string;
  amount: string;
  count: number;
  widthPct: number;
}

export interface InvoiceRow {
  id: string;
  customerName: string;
  invoiceNumber: string;
  dueDate: string;
  amount: string;
  balanceDue: string;
  overdueLabel: string;
  isOverdue: boolean;
  bucketLabel: string;
  bucketClass: string;
  statusLabel: string;
  statusClass: string;
}

const STATUS_OPTIONS: { value: "" | InvoiceStatus; label: string }[] = [
  { value: "", label: "Status: All" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "partial", label: "Partial" },
  { value: "disputed", label: "Disputed" },
  { value: "paid", label: "Paid" },
];

interface SortDef {
  value: string;
  label: string;
  compare: (a: InvoiceListItem, b: InvoiceListItem) => number;
}

const SORT_OPTIONS: SortDef[] = [
  {
    value: "due_date:asc",
    label: "Due date (oldest first)",
    compare: (a, b) => a.dueDate.localeCompare(b.dueDate),
  },
  {
    value: "due_date:desc",
    label: "Due date (newest first)",
    compare: (a, b) => b.dueDate.localeCompare(a.dueDate),
  },
  {
    value: "amount_cents:desc",
    label: "Amount: High–Low",
    compare: (a, b) => b.amountCents - a.amountCents,
  },
  {
    value: "days_overdue:desc",
    label: "Most overdue",
    compare: (a, b) => b.daysOverdue - a.daysOverdue,
  },
  {
    value: "customer_name:asc",
    label: "Customer A–Z",
    compare: (a, b) => a.customer.companyName.localeCompare(b.customer.companyName),
  },
];

const DEFAULT_SORT = "due_date:asc";

function toAgingSegments(aging: AgingBuckets): AgingSegment[] {
  const total = BUCKET_ORDER.reduce((s, k) => s + aging[k].totalCents, 0);
  return BUCKET_ORDER.map((k) => ({
    key: k,
    label: BUCKET_META[k].label,
    color: BUCKET_META[k].color,
    amount: formatCents(aging[k].totalCents),
    count: aging[k].count,
    widthPct: total > 0 ? (aging[k].totalCents / total) * 100 : 0,
  }));
}

function toRow(item: InvoiceListItem): InvoiceRow {
  const meta = BUCKET_META[bucketOf(item.daysOverdue)];
  return {
    id: item.id,
    customerName: item.customer.companyName,
    invoiceNumber: item.invoiceNumber ? `#${item.invoiceNumber}` : "—",
    dueDate: formatShortDate(item.dueDate),
    amount: formatCents(item.amountCents),
    balanceDue: formatCents(item.balanceDueCents),
    overdueLabel: item.daysOverdue > 0 ? `${item.daysOverdue} days` : "—",
    isOverdue: item.daysOverdue > 0,
    bucketLabel: meta.label,
    bucketClass: meta.badgeClass,
    statusLabel: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    statusClass: STATUS_BADGE[item.status],
  };
}

function downloadCsv(rows: InvoiceRow[]): void {
  const header = [
    "Customer",
    "Invoice",
    "Due date",
    "Amount",
    "Balance due",
    "Overdue",
    "Bucket",
    "Status",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.customerName,
      r.invoiceNumber,
      r.dueDate,
      r.amount,
      r.balanceDue,
      r.overdueLabel,
      r.bucketLabel,
      r.statusLabel,
    ]
      .map(escape)
      .join(","),
  );
  const csv = [header.map(escape).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ar-aging-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function useReportsViewModel() {
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();

  const summaryQuery = useDashboardSummary(businessId);
  const invoicesQuery = useInvoicesInfinite(businessId);
  const triggerSync = useTriggerSync();

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = invoicesQuery;

  // Pull every page so we can sort/search/filter/paginate the full set locally.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [dateRange, setDateRangeState] = useState<DateRange>({ start: null, end: null });
  const [status, setStatusState] = useState<"" | InvoiceStatus>("");
  const [search, setSearchState] = useState("");
  const [sortValue, setSortState] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const allItems = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data),
    [data],
  );

  const agingSegments = useMemo(
    () => (summaryQuery.data ? toAgingSegments(summaryQuery.data.aging) : []),
    [summaryQuery.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sort = SORT_OPTIONS.find((s) => s.value === sortValue) ?? SORT_OPTIONS[0];
    const out = allItems.filter((i) => {
      const day = i.dueDate.slice(0, 10);
      if (dateRange.start && day < dateRange.start) return false;
      if (dateRange.end && day > dateRange.end) return false;
      if (status && i.status !== status) return false;
      if (q) {
        const num = (i.invoiceNumber ?? "").toLowerCase();
        const name = i.customer.companyName.toLowerCase();
        if (!num.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
    return [...out].sort(sort.compare);
  }, [allItems, dateRange, status, search, sortValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(toRow),
    [filtered, safePage],
  );

  const resetPage = () => setPage(1);

  const handleSyncNow = useCallback(async () => {
    if (!businessId) return;
    setSyncMessage(null);
    setSyncError(null);
    try {
      const result = await triggerSync.mutateAsync(businessId);
      setSyncMessage(result.message ?? "Sync started.");
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Couldn't start sync.");
    }
  }, [businessId, triggerSync]);

  const handleExportCsv = useCallback(() => downloadCsv(rows), [rows]);

  return {
    agingSegments,
    summaryLoading: businessLoading || summaryQuery.isLoading,
    summaryError: summaryQuery.error,
    refetchSummary: summaryQuery.refetch,

    // filters
    dateRange,
    setDateRange: (r: DateRange) => {
      setDateRangeState(r);
      resetPage();
    },
    status,
    statusOptions: STATUS_OPTIONS,
    setStatus: (s: string) => {
      setStatusState(s as "" | InvoiceStatus);
      resetPage();
    },
    sortValue,
    sortOptions: SORT_OPTIONS.map(({ value, label }) => ({ value, label })),
    setSort: (v: string) => {
      setSortState(v);
      resetPage();
    },
    search,
    setSearch: (v: string) => {
      setSearchState(v);
      resetPage();
    },

    // table
    rows,
    tableLoading: businessLoading || isLoading,
    tableError: error,
    refetchTable: refetch,
    isLoadingMore: isFetchingNextPage,
    filteredTotal: filtered.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
    setPage,

    // actions
    isSyncing: triggerSync.isPending,
    syncMessage,
    syncError,
    handleSyncNow,
    handleExportCsv,
  };
}
