import type { RecentWinItem } from "./recent-win-item.entity";

export const RECENT_WINS_REPOSITORY = Symbol("RECENT_WINS_REPOSITORY");

export interface RecentWinsRepository {
  /**
   * Returns up to `limit` recently-paid invoices for the business, sorted by
   * paidAt DESC. Only invoices with status 'paid' and a non-null paid_at are
   * included.
   */
  listItems(businessId: string, limit: number): Promise<RecentWinItem[]>;
}
