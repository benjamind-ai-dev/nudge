export interface RecentWinItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  amountCents: number;
  paidAt: string; // ISO 8601 UTC
}
