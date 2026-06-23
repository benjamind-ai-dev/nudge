import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { formatDollars } from "../../lib/format";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useOverdueInvoices, useStartFollowUp } from "../../queries/use-overdue-invoices";
import type { InvoiceListItem } from "../../api/invoices.api";

export const PAGE_SIZE = 10;

// ---- Aging dot colours per spec -------------------------------------------
function agingDotColor(daysOverdue: number): string {
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
  followUpStatus: FollowUpStatus;
  sequenceRunId: string | null;
  isSevere: boolean;         // daysOverdue >= 90 → faint red row tint
}

function toRow(item: InvoiceListItem): OverdueRow {
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
    followUpStatus: followUpStatus(item),
    sequenceRunId: item.sequenceRun?.id ?? null,
    isSevere: item.daysOverdue >= 90,
  };
}

// ---- View model ------------------------------------------------------------
export interface GetPaidViewModel {
  // Paginated rows (current page slice)
  rows: OverdueRow[];
  // All rows (full loaded set, up to 100 — see note in urgency strip)
  allRows: OverdueRow[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  setPage: (p: number) => void;

  // Urgency strip totals (capped at 100-invoice fetch limit)
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

  // Navigation — wires the dead "View sequence" / "Resume" buttons.
  // Deep-linking to the specific sequence run is a follow-up TODO.
  onViewSequence: () => void;
}

export function useGetPaidViewModel(): GetPaidViewModel {
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();
  const query = useOverdueInvoices(businessId);
  const startFollowUpMutation = useStartFollowUp();
  const navigate = useNavigate();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogInvoiceId, setDialogInvoiceId] = useState<string | null>(null);
  const [dialogInvoiceNumber, setDialogInvoiceNumber] = useState("");
  const [dialogCustomerName, setDialogCustomerName] = useState("");
  const [dialogAmount, setDialogAmount] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [alreadyRunning, setAlreadyRunning] = useState(false);
  const [page, setPageState] = useState(1);

  const allRows = useMemo(
    () => (query.data?.data ?? []).map(toRow),
    [query.data],
  );

  // Client-side pagination — clamp page when data changes
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = useMemo(
    () => allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [allRows, safePage],
  );

  // Urgency strip totals — summed over the full loaded set.
  // Note: capped at the 100-invoice fetch limit imposed by useOverdueInvoices.
  const totalOverdueCents = useMemo(
    () => allRows.reduce((sum, r) => sum + r.balanceDueCents, 0),
    [allRows],
  );
  const overdueCount = allRows.length;

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
  }, [dialogInvoiceId, businessId, startFollowUpMutation, closeDialog]);

  // Deep-linking to a specific sequence run is a follow-up TODO.
  const onViewSequence = useCallback(() => {
    void navigate("/sequences");
  }, [navigate]);

  return {
    rows,
    allRows,
    isLoading: businessLoading || query.isLoading,
    error: query.error,
    refetch: query.refetch,

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

    onViewSequence,
  };
}
