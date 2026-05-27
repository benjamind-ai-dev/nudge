import type { NeedsAttentionItem } from "./needs-attention-item.entity";

export const NEEDS_ATTENTION_REPOSITORY = Symbol("NEEDS_ATTENTION_REPOSITORY");

export interface NeedsAttentionRepository {
  /**
   * Returns up to `limit` items sorted by occurredAt DESC, drawn from the
   * union of four sources: client replies, owner-alert step executions,
   * disputed invoices, and stale (>=90 days overdue) invoices not already
   * surfaced by one of the first three. De-duplication key is `invoiceId`:
   * if the same invoice qualifies under multiple sources, the highest-priority
   * source wins (priority order: client_replied > owner_alert_triggered >
   * disputed > stale_no_response).
   */
  listItems(businessId: string, limit: number): Promise<NeedsAttentionItem[]>;
}
