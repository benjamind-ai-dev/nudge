import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { formatCents } from "../../lib/format";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useDashboardSummary, useTriggerSync } from "../../queries/use-dashboard";
import { useInvoices } from "../../queries/use-invoices";
import type { AgingBuckets } from "../../api/dashboard.api";
import type {
  InvoiceListItem,
  InvoiceSortBy,
  InvoiceStatus,
  SortOrder,
} from "../../api/invoices.api";

const PAGE_SIZE = 10;

// --- Aging buckets ---
export type BucketKey =
  | "current"
  | "days1to30"
  | "days31to60"
  | "days61to90"
  | "days90plus";

export type BucketFilter = "all" | BucketKey;

const BUCKET_META: Record<
  BucketKey,
  { label: string; color: string; badgeClass: string }
> = {
  current: {
    label: "Current",
    color: "#10B981",
    badgeClass: "bg-[#10B981]/10 text-[#047857]",
  },
  days1to30: {
    label: "1–30 Days",
    color: "#FBBF24",
    badgeClass: "bg-[#FBBF24]/10 text-[#B45309]",
  },
  days31to60: {
    label: "31–60 Days",
    color: "#FB923C",
    badgeClass: "bg-[#FB923C]/10 text-[#C2410C]",
  },
  days61to90: {
    label: "61–90 Days",
    color: "#EF4444",
    badgeClass: "bg-[#EF4444]/10 text-[#EF4444]",
  },
  days90plus: {
    label: "90+ Days",
    color: "#7F1D1D",
    badgeClass: "bg-[#7F1D1D]/10 text-[#7F1D1D]",
  },
};

const BUCKET_ORDER: BucketKey[] = [
  "current",
  "days1to30",
  "days31to60",
  "days61to90",
  "days90plus",
];

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  overdue: "bg-[#BA1A1A]/10 text-[#BA1A1A]",
  partial: "bg-[#FBBF24]/15 text-[#B45309]",
  paid: "bg-green-100 text-green-700",
  disputed: "bg-purple-100 text-purple-700",
  open: "bg-[#E2E2E2] text-[#45464E]",
  voided: "bg-gray-100 text-gray-500",
};

function bucketOf(daysOverdue: number): BucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "days1to30";
  if (daysOverdue <= 60) return "days31to60";
  if (daysOverdue <= 90) return "days61to90";
  return "days90plus";
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return isoDay(d);
}

/**
 * Buckets are server-filtered via due-date ranges, since the invoices endpoint
 * has no daysOverdue filter. daysOverdue = today − dueDate, so e.g. "1–30 days
 * overdue" = dueDate in [today−30, today−1].
 */
function bucketDateRange(bucket: BucketFilter): {
  dueAfter?: string;
  dueBefore?: string;
} {
  switch (bucket) {
    case "current":
      return { dueAfter: daysFromToday(0) };
    case "days1to30":
      return { dueAfter: daysFromToday(-30), dueBefore: daysFromToday(-1) };
    case "days31to60":
      return { dueAfter: daysFromToday(-60), dueBefore: daysFromToday(-31) };
    case "days61to90":
      return { dueAfter: daysFromToday(-90), dueBefore: daysFromToday(-61) };
    case "days90plus":
      return { dueBefore: daysFromToday(-91) };
    default:
      return {};
  }
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

// Default sort is due date ascending — oldest-due (most overdue) first, the
// collections worklist order.
const SORT_OPTIONS: { value: string; label: string; sortBy: InvoiceSortBy; sortOrder: SortOrder }[] = [
  { value: "due_date:asc", label: "Due date (oldest first)", sortBy: "due_date", sortOrder: "asc" },
  { value: "due_date:desc", label: "Due date (newest first)", sortBy: "due_date", sortOrder: "desc" },
  { value: "amount_cents:desc", label: "Amount: High–Low", sortBy: "amount_cents", sortOrder: "desc" },
  { value: "days_overdue:desc", label: "Most overdue", sortBy: "days_overdue", sortOrder: "desc" },
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
  const bucket = bucketOf(item.daysOverdue);
  const meta = BUCKET_META[bucket];
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
  const navigate = useNavigate();
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();
  const [params, setParams] = useSearchParams();

  // Customer search filters the loaded page client-side (the invoices endpoint
  // has no search param).
  const [customerSearch, setCustomerSearch] = useState("");

  const bucket = (params.get("bucket") ?? "all") as BucketFilter;
  const status = (params.get("status") ?? "") as "" | InvoiceStatus;
  const sortValue = params.get("sort") ?? DEFAULT_SORT;
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const sortOption =
    SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0];

  const summaryQuery = useDashboardSummary(businessId);
  const triggerSync = useTriggerSync();

  const range = bucketDateRange(bucket);
  const invoicesQuery = useInvoices({
    businessId,
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    dueAfter: range.dueAfter,
    dueBefore: range.dueBefore,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
  });

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const agingSegments = useMemo(
    () => (summaryQuery.data ? toAgingSegments(summaryQuery.data.aging) : []),
    [summaryQuery.data],
  );

  const allRows = useMemo(
    () => (invoicesQuery.data?.data ?? []).map(toRow),
    [invoicesQuery.data],
  );

  const rows = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q),
    );
  }, [allRows, customerSearch]);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page"); // reset paging on filter change
        return next;
      });
    },
    [setParams],
  );

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

  const handleRowClick = useCallback(
    (id: string) => navigate(`/invoices/${id}`),
    [navigate],
  );

  const pagination = invoicesQuery.data?.pagination;

  return {
    // summary
    agingSegments,
    summaryLoading: businessLoading || summaryQuery.isLoading,
    summaryError: summaryQuery.error,
    refetchSummary: summaryQuery.refetch,

    // filters
    bucket,
    setBucket: (b: BucketFilter) => setParam("bucket", b === "all" ? "" : b),
    bucketOptions: [
      { value: "all" as BucketFilter, label: "All" },
      ...BUCKET_ORDER.map((k) => ({
        value: k as BucketFilter,
        label: k === "days90plus" ? "90+" : BUCKET_META[k].label.replace(" Days", "").replace("–", "-"),
      })),
    ],
    status,
    statusOptions: STATUS_OPTIONS,
    setStatus: (s: string) => setParam("status", s),
    sortValue,
    sortOptions: SORT_OPTIONS,
    setSort: (v: string) => setParam("sort", v),
    customerSearch,
    setCustomerSearch,

    // table
    rows,
    tableLoading: businessLoading || invoicesQuery.isLoading,
    tableError: invoicesQuery.error,
    refetchTable: invoicesQuery.refetch,
    pagination,
    page,
    setPage: (p: number) => setParam("page", String(p)),

    // actions
    isSyncing: triggerSync.isPending,
    syncMessage,
    syncError,
    handleSyncNow,
    handleExportCsv,
    handleRowClick,
  };
}
