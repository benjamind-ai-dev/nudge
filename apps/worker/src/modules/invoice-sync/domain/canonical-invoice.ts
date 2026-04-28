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

export interface PriorInvoiceState {
  status: InvoiceStatus;
  balanceDueCents: number;
}

export type InvoiceTransition =
  | { kind: "no_change" }
  | { kind: "new_invoice" }
  | { kind: "balance_changed"; priorBalance: number; newBalance: number }
  | { kind: "fully_paid"; priorBalance: number }
  | { kind: "partial_payment"; priorBalance: number; newBalance: number }
  | { kind: "voided"; priorBalance: number; priorStatus: InvoiceStatus };

/**
 * Pure transition detection. Top-to-bottom rule order — first match wins.
 *
 * Provider-agnostic: takes a generic prior state + canonical invoice. The
 * caller is responsible for fetching the prior state out of the DB.
 */
export function detectInvoiceTransition(
  prior: PriorInvoiceState | undefined,
  next: CanonicalInvoice,
  _now: Date,
): InvoiceTransition {
  if (!prior) return { kind: "new_invoice" };
  if (prior.status === "voided") return { kind: "no_change" };
  if (prior.status === "paid") return { kind: "no_change" };

  if (next.lifecycle === "voided") {
    return {
      kind: "voided",
      priorBalance: prior.balanceDueCents,
      priorStatus: prior.status,
    };
  }

  if (next.balanceDueCents <= 0) {
    return { kind: "fully_paid", priorBalance: prior.balanceDueCents };
  }

  if (next.balanceDueCents < prior.balanceDueCents) {
    return {
      kind: "partial_payment",
      priorBalance: prior.balanceDueCents,
      newBalance: next.balanceDueCents,
    };
  }

  if (next.balanceDueCents !== prior.balanceDueCents) {
    return {
      kind: "balance_changed",
      priorBalance: prior.balanceDueCents,
      newBalance: next.balanceDueCents,
    };
  }

  return { kind: "no_change" };
}
