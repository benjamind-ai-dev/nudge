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
