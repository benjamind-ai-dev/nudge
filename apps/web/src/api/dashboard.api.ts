import { apiClient } from "./client";

export interface Outstanding {
  totalCents: number;
  count: number;
}

export interface BucketTotal {
  totalCents: number;
  count: number;
}

export interface AgingBuckets {
  current: BucketTotal;
  days1to30: BucketTotal;
  days31to60: BucketTotal;
  days61to90: BucketTotal;
  days90plus: BucketTotal;
}

export interface DashboardSummary {
  outstanding: Outstanding;
  recoveredThisMonth: {
    totalCents: number;
    pctChangeVsLastMonth: number;
  };
  avgDaysToPay: {
    currentDays: number;
    previousDays: number;
  };
  activeSequences: {
    count: number;
  };
  aging: AgingBuckets;
}

export type NeedsAttentionType =
  | "client_replied"
  | "owner_alert_triggered"
  | "disputed"
  | "stale_no_response";

export interface NeedsAttentionItem {
  id: string;
  type: NeedsAttentionType;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  amountCents: number;
  balanceDueCents: number;
  daysOverdue: number;
  occurredAt: string; // ISO 8601 UTC
  summary: string;
}

export interface RecentWinItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  amountCents: number;
  paidAt: string; // ISO 8601 UTC
}

export function getDashboardSummary(
  businessId: string,
): Promise<{ data: DashboardSummary }> {
  const qs = new URLSearchParams({ businessId });
  return apiClient(`/v1/dashboard/summary?${qs}`);
}

export function listNeedsAttention(params: {
  businessId: string;
  limit?: number;
}): Promise<{ data: NeedsAttentionItem[] }> {
  const qs = new URLSearchParams({ businessId: params.businessId });
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  return apiClient(`/v1/dashboard/needs-attention?${qs}`);
}

export function listRecentWins(params: {
  businessId: string;
  limit?: number;
}): Promise<{ data: RecentWinItem[] }> {
  const qs = new URLSearchParams({ businessId: params.businessId });
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  return apiClient(`/v1/dashboard/recent-wins?${qs}`);
}
