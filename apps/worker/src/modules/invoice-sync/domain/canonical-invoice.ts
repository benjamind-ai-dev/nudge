export type CanonicalInvoiceLifecycle = "active" | "voided";

export interface CanonicalCustomer {
  externalId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

/**
 * Canonical invoice DTO that every InvoiceSyncProvider emits, so status
 * logic in `deriveStatus` doesn't drift between providers.
 *
 * Invariants the provider mapper enforces (deriveStatus does NOT re-check):
 * - `amountCents - amountPaidCents === balanceDueCents`
 * - `dueDate` is non-null; mappers coerce to `issuedDate` (or, as a last
 *   resort, `now`) when the provider omits it — e.g., QuickBooks draft
 *   invoices that have no DueDate set yet.
 *
 * `paymentLinkUrl` is populated by providers that expose a customer-facing
 * payment/invoice URL (Xero's OnlineInvoiceUrl); `null` when the provider
 * doesn't have one (e.g., QuickBooks today).
 */
export interface CanonicalInvoice {
  externalId: string;
  invoiceNumber: string | null;
  customerExternalId: string;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  paymentLinkUrl: string | null;
  issuedDate: Date | null;
  dueDate: Date;
  lifecycle: CanonicalInvoiceLifecycle;
  lastUpdatedAt: Date;
}

export type InvoiceStatus = "open" | "overdue" | "partial" | "paid" | "voided";

export function deriveStatus(inv: CanonicalInvoice, now: Date): InvoiceStatus {
  if (inv.lifecycle === "voided") return "voided";
  if (inv.balanceDueCents <= 0) return "paid";
  if (inv.balanceDueCents < inv.amountCents) return "partial";
  return inv.dueDate < now ? "overdue" : "open";
}
