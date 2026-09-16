import type { Prisma } from "@prisma/client";

/**
 * Single source of truth for "is this tenant allowed to receive service".
 *
 * Mirrors the web `BillingGate`: only an `active` (paid) account is entitled.
 * `trial`, `past_due`, `canceled`, `incomplete`, etc. are all treated as
 * unpaid — no sequences are triggered, no emails/SMS are sent, no weekly
 * summaries or AI drafts are generated, no invoice syncs run, and the API
 * refuses business-scoped requests.
 */
export const ENTITLED_ACCOUNT_STATUSES = ["active"] as const;

export function isAccountEntitled(status: string | null | undefined): boolean {
  return (
    status != null &&
    (ENTITLED_ACCOUNT_STATUSES as readonly string[]).includes(status)
  );
}

/** Prisma `where` fragment: account is paid. */
export function entitledAccountWhere(): Prisma.AccountWhereInput {
  return { status: { in: [...ENTITLED_ACCOUNT_STATUSES] } };
}

/**
 * Prisma `where` fragment: business is not soft-deleted AND its account is
 * paid. Spread this into every worker query that selects work to perform on
 * behalf of a tenant, and into any relation filter (`business: {...}`).
 */
export function entitledBusinessWhere(): Prisma.BusinessWhereInput {
  return { isActive: true, account: entitledAccountWhere() };
}
