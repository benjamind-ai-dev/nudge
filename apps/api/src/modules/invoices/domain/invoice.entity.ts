export type InvoiceStatus = "open" | "overdue" | "partial" | "paid" | "voided";

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  status: InvoiceStatus;
  amountCents: number;
  balanceDueCents: number;
  currency: string;
  daysOverdue: number;
  dueDate: Date;
  issuedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
