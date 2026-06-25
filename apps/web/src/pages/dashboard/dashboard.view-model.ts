import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { formatCents } from "../../lib/format";
import {
  useDashboardSummary,
  useNeedsAttention,
  useRecentWins,
  useTriggerSync,
} from "../../queries/use-dashboard";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import type {
  AgingBuckets,
  NeedsAttentionItem,
  NeedsAttentionType,
  RecentWinItem,
} from "../../api/dashboard.api";

const ATTENTION_LIMIT = 4;
const WINS_LIMIT = 5;

interface AttentionBadge {
  label: string;
  className: string;
}

const BADGE_BY_TYPE: Record<NeedsAttentionType, AttentionBadge> = {
  client_replied: { label: "Replied", className: "bg-blue-500/15 text-blue-300" },
  disputed: { label: "Disputed", className: "bg-orange-500/15 text-orange-300" },
  owner_alert_triggered: {
    label: "Escalated",
    className: "bg-red-500/15 text-red-300",
  },
  stale_no_response: {
    label: "No response",
    className: "bg-slate-500/15 text-slate-300",
  },
};

const AGING_CONFIG: { key: keyof AgingBuckets; label: string; color: string }[] = [
  { key: "current", label: "Current", color: "#10B981" },
  { key: "days1to30", label: "1-30 Days", color: "#FBBF24" },
  { key: "days31to60", label: "31-60 Days", color: "#FB923C" },
  { key: "days61to90", label: "61-90 Days", color: "#EF4444" },
  { key: "days90plus", label: "90+ Days", color: "#7F1D1D" },
];

export interface AgingSegment {
  key: string;
  label: string;
  color: string;
  amount: string;
  count: number;
  widthPct: number;
}

export interface AttentionRow {
  id: string;
  customerName: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  summary: string;
  badge: AttentionBadge;
}

export interface WinRow {
  id: string;
  customerName: string;
  amount: string;
  description: string;
  relativeTime: string;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function toAttentionRow(item: NeedsAttentionItem): AttentionRow {
  return {
    id: item.id,
    customerName: item.customerName,
    invoiceNumber: item.invoiceNumber ? `#${item.invoiceNumber}` : "—",
    amount: formatCents(item.amountCents),
    daysOverdue: item.daysOverdue,
    summary: item.summary,
    badge: BADGE_BY_TYPE[item.type],
  };
}

function toWinRow(item: RecentWinItem): WinRow {
  const invoiceLabel = item.invoiceNumber
    ? `Invoice #${item.invoiceNumber} paid in full.`
    : "Payment received in full.";
  return {
    id: item.id,
    customerName: item.customerName,
    amount: `+${formatCents(item.amountCents)}`,
    description: invoiceLabel,
    relativeTime: relativeTime(item.paidAt),
  };
}

function toAgingSegments(aging: AgingBuckets): AgingSegment[] {
  const total = AGING_CONFIG.reduce((sum, c) => sum + aging[c.key].totalCents, 0);
  return AGING_CONFIG.map((c) => {
    const bucket = aging[c.key];
    return {
      key: c.key,
      label: c.label,
      color: c.color,
      amount: formatCents(bucket.totalCents),
      count: bucket.count,
      widthPct: total > 0 ? (bucket.totalCents / total) * 100 : 0,
    };
  });
}

export function useDashboardViewModel() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { businessId, isLoading: businessLoading } = useActiveBusinessId();

  const summaryQuery = useDashboardSummary(businessId);
  const attentionQuery = useNeedsAttention(businessId, ATTENTION_LIMIT);
  const winsQuery = useRecentWins(businessId, WINS_LIMIT);
  const triggerSync = useTriggerSync();

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const firstName = user?.firstName ?? null;

  const summary = summaryQuery.data;

  const kpis = useMemo(() => {
    if (!summary) return null;
    return {
      outstanding: {
        value: formatCents(summary.outstanding.totalCents),
        count: summary.outstanding.count,
      },
      recovered: {
        value: formatCents(summary.recoveredThisMonth.totalCents),
        pctChange: summary.recoveredThisMonth.pctChangeVsLastMonth,
      },
      avgDaysToPay: {
        current: summary.avgDaysToPay.currentDays,
        previous: summary.avgDaysToPay.previousDays,
      },
      activeSequences: summary.activeSequences.count,
    };
  }, [summary]);

  const agingSegments = useMemo(
    () => (summary ? toAgingSegments(summary.aging) : []),
    [summary],
  );

  const attentionRows = useMemo(
    () => (attentionQuery.data ?? []).map(toAttentionRow),
    [attentionQuery.data],
  );

  const winRows = useMemo(
    () => (winsQuery.data ?? []).map(toWinRow),
    [winsQuery.data],
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

  const goToInvoices = useCallback(() => navigate("/invoices"), [navigate]);
  const goToCustomers = useCallback(() => navigate("/customers"), [navigate]);
  const goToReports = useCallback(() => navigate("/reports"), [navigate]);

  return {
    firstName,

    kpis,
    summaryLoading: businessLoading || summaryQuery.isLoading,
    summaryError: summaryQuery.error,
    refetchSummary: summaryQuery.refetch,

    agingSegments,

    attentionRows,
    attentionLoading: businessLoading || attentionQuery.isLoading,
    attentionError: attentionQuery.error,
    refetchAttention: attentionQuery.refetch,

    winRows,
    winsLoading: businessLoading || winsQuery.isLoading,
    winsError: winsQuery.error,
    refetchWins: winsQuery.refetch,

    isSyncing: triggerSync.isPending,
    syncMessage,
    syncError,
    handleSyncNow,
    goToInvoices,
    goToCustomers,
    goToReports,
  };
}
