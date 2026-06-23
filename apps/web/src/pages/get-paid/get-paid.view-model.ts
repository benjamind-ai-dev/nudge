import { useCallback, useMemo, useState } from "react";
import { formatCents } from "../../lib/format";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useOverdueInvoices, useStartFollowUp } from "../../queries/use-overdue-invoices";
import type { InvoiceListItem } from "../../api/invoices.api";

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

// ---- Exported row shape ----------------------------------------------------
export interface OverdueRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issuedDate: string | null; // ISO string, formatted in view model
  dueDate: string; // formatted
  daysOverdue: number;
  balanceDue: string; // formatted cents
  paymentLinkUrl: string | null;
  agingDotColor: string;
  followUpStatus: FollowUpStatus;
  sequenceRunId: string | null;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function toRow(item: InvoiceListItem): OverdueRow {
  return {
    id: item.id,
    invoiceNumber: item.invoiceNumber ? `#${item.invoiceNumber}` : "—",
    customerName: item.customer.companyName,
    issuedDate: item.issuedDate ? formatShortDate(item.issuedDate) : null,
    dueDate: formatShortDate(item.dueDate),
    daysOverdue: item.daysOverdue,
    balanceDue: formatCents(item.balanceDueCents),
    paymentLinkUrl: item.paymentLinkUrl,
    agingDotColor: agingDotColor(item.daysOverdue),
    followUpStatus: followUpStatus(item),
    sequenceRunId: item.sequenceRun?.id ?? null,
  };
}

// ---- View model ------------------------------------------------------------
export interface GetPaidViewModel {
  rows: OverdueRow[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;

  // Expanded row
  expandedId: string | null;
  toggleExpand: (id: string) => void;

  // Dialog
  dialogInvoiceId: string | null;
  dialogInvoiceNumber: string;
  dialogCustomerName: string;
  isDialogOpen: boolean;
  openDialog: (row: OverdueRow) => void;
  closeDialog: () => void;
  handleStartFollowUp: () => Promise<void>;
  isStarting: boolean;
  startError: string | null;
  alreadyRunning: boolean;
}

export function useGetPaidViewModel(): GetPaidViewModel {
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();
  const query = useOverdueInvoices(businessId);
  const startFollowUpMutation = useStartFollowUp();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogInvoiceId, setDialogInvoiceId] = useState<string | null>(null);
  const [dialogInvoiceNumber, setDialogInvoiceNumber] = useState("");
  const [dialogCustomerName, setDialogCustomerName] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [alreadyRunning, setAlreadyRunning] = useState(false);

  const rows = useMemo(
    () => (query.data?.data ?? []).map(toRow),
    [query.data],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const openDialog = useCallback((row: OverdueRow) => {
    setDialogInvoiceId(row.id);
    setDialogInvoiceNumber(row.invoiceNumber);
    setDialogCustomerName(row.customerName);
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

  return {
    rows,
    isLoading: businessLoading || query.isLoading,
    error: query.error,
    refetch: query.refetch,

    expandedId,
    toggleExpand,

    dialogInvoiceId,
    dialogInvoiceNumber,
    dialogCustomerName,
    isDialogOpen: dialogInvoiceId !== null,
    openDialog,
    closeDialog,
    handleStartFollowUp,
    isStarting: startFollowUpMutation.isPending,
    startError,
    alreadyRunning,
  };
}
