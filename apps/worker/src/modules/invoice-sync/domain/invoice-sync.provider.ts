import type { ProviderName, ProviderTokens } from "@nudge/connections-domain";
import type { CanonicalCustomer, CanonicalInvoice } from "./canonical-invoice";

export interface InvoiceSyncPage {
  invoices: CanonicalInvoice[];
  customers: CanonicalCustomer[];
  hasMore: boolean;
}

export interface InvoiceSyncFetchArgs {
  tokens: ProviderTokens;
  tenantId: string;
  cursor: Date;
  offset: number;
  pageSize: number;
}

export interface InvoiceSyncProvider {
  readonly name: ProviderName;
  fetchPage(args: InvoiceSyncFetchArgs): Promise<InvoiceSyncPage>;
}

export const INVOICE_SYNC_PROVIDERS = Symbol("INVOICE_SYNC_PROVIDERS");
export type InvoiceSyncProviderMap = Partial<
  Record<ProviderName, InvoiceSyncProvider>
>;

export class AuthError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limited; retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
  }
}

export class SyncFailedError extends Error {
  constructor(cause?: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "SyncFailedError";
    if (cause instanceof Error) this.cause = cause;
  }
}
