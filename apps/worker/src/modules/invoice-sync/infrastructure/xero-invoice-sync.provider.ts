import { Injectable, Logger } from "@nestjs/common";
import type { ProviderName, ProviderTokens } from "@nudge/connections-domain";
import type {
  CanonicalCustomer,
  CanonicalInvoice,
  CanonicalInvoiceLifecycle,
} from "../domain/canonical-invoice";
import {
  AuthError,
  type InvoiceSyncFetchArgs,
  type InvoiceSyncPage,
  type InvoiceSyncProvider,
  RateLimitError,
  SyncFailedError,
} from "../domain/invoice-sync.provider";
import {
  centsFromDecimal,
  DEFAULT_CURRENCY,
  joinContactName,
  parseProviderDate,
} from "../domain/provider-mapping";

// ─────────────────────────────────────────────────────────────────────────────
// Raw Xero API shapes
// ─────────────────────────────────────────────────────────────────────────────

type XeroInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type?: string; // "ACCREC" | "ACCPAY" — we filter server-side
  Status?: string; // DRAFT|SUBMITTED|AUTHORISED|PAID|VOIDED|DELETED
  Total?: number | string; // Xero sends decimals; tolerate string too
  AmountDue?: number | string;
  AmountPaid?: number | string; // not used directly — we compute from Total-AmountDue
  Date?: string; // issued date
  DueDate?: string;
  UpdatedDateUTC?: string; // /Date(...)/ format, for cursor
  Contact: { ContactID: string; Name?: string };
  CurrencyCode?: string;
};

type XeroPhone = {
  PhoneType?: string; // DEFAULT|MOBILE|FAX|DDI
  PhoneNumber?: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
};

type XeroContact = {
  ContactID: string;
  Name?: string; // company/display name
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: XeroPhone[];
};

const XERO_BASE = "https://api.xero.com/api.xro/2.0";
const DEFAULT_RETRY_AFTER_MS = 30_000;
// Xero caps /Invoices pagination at 100 per page regardless of caller's
// pageSize — that argument is intentionally not forwarded.
const XERO_PAGE_SIZE = 100;
// Exclude pre-send states (DRAFT, SUBMITTED) — dunning a customer for an
// invoice they haven't received would be wrong.
const SYNCABLE_STATUSES = ["AUTHORISED", "PAID", "VOIDED", "DELETED"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pure mappers (exported for direct testing)
// ─────────────────────────────────────────────────────────────────────────────

export function mapXeroInvoice(raw: XeroInvoice): CanonicalInvoice {
  const amountCents = centsFromDecimal(raw.Total);
  const balanceDueCents = centsFromDecimal(raw.AmountDue);
  const amountPaidCents = Math.max(0, amountCents - balanceDueCents);

  const lifecycle: CanonicalInvoiceLifecycle =
    raw.Status === "VOIDED" || raw.Status === "DELETED" ? "voided" : "active";

  const issuedDate = parseProviderDate(raw.Date);
  const parsedDueDate = parseProviderDate(raw.DueDate);
  const dueDate = parsedDueDate ?? issuedDate ?? new Date();

  const lastUpdatedAt = parseProviderDate(raw.UpdatedDateUTC) ?? new Date();

  return {
    externalId: raw.InvoiceID,
    invoiceNumber: raw.InvoiceNumber ?? null,
    customerExternalId: raw.Contact.ContactID,
    amountCents,
    amountPaidCents,
    balanceDueCents,
    currency: raw.CurrencyCode ?? DEFAULT_CURRENCY,
    paymentLinkUrl: null,
    issuedDate,
    dueDate,
    lifecycle,
    lastUpdatedAt,
  };
}

export function mapXeroCustomer(raw: XeroContact): CanonicalCustomer {
  const companyName = raw.Name?.trim() || `Customer ${raw.ContactID}`;
  const contactName = joinContactName(raw.FirstName, raw.LastName, raw.Name);

  const contactEmail =
    raw.EmailAddress?.trim() ? raw.EmailAddress.trim() : null;

  // Prefer DEFAULT phone type; fall back to first non-empty PhoneNumber
  let contactPhone: string | null = null;
  if (raw.Phones && raw.Phones.length > 0) {
    const defaultPhone = raw.Phones.find(
      (p) => p.PhoneType === "DEFAULT" && p.PhoneNumber,
    );
    if (defaultPhone?.PhoneNumber) {
      contactPhone = defaultPhone.PhoneNumber;
    } else {
      const firstNonEmpty = raw.Phones.find((p) => p.PhoneNumber);
      contactPhone = firstNonEmpty?.PhoneNumber ?? null;
    }
  }

  return {
    externalId: raw.ContactID,
    companyName,
    contactName,
    contactEmail,
    contactPhone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider class
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class XeroInvoiceSyncProvider implements InvoiceSyncProvider {
  readonly name: ProviderName = "xero";

  private readonly logger = new Logger(XeroInvoiceSyncProvider.name);

  async fetchPage(args: InvoiceSyncFetchArgs): Promise<InvoiceSyncPage> {
    const invoiceRows = await this.fetchInvoices(args);

    const uniqueContactIds = Array.from(
      new Set(invoiceRows.map((i) => i.Contact.ContactID)),
    );

    const contactRows =
      uniqueContactIds.length > 0
        ? await this.fetchContacts(args, uniqueContactIds)
        : [];

    const invoices: CanonicalInvoice[] = invoiceRows.map(mapXeroInvoice);
    const customers: CanonicalCustomer[] = contactRows.map(mapXeroCustomer);

    // Fetch OnlineInvoiceUrl for each AUTHORISED invoice (sequential to respect rate limits)
    for (let i = 0; i < invoiceRows.length; i++) {
      if (invoiceRows[i].Status === "AUTHORISED") {
        invoices[i].paymentLinkUrl = await this.fetchOnlineInvoiceUrl(
          args.tokens,
          args.tenantId,
          invoiceRows[i].InvoiceID,
        );
      }
    }

    return {
      invoices,
      customers,
      hasMore: invoiceRows.length === XERO_PAGE_SIZE,
    };
  }

  private buildInvoiceUrl(args: InvoiceSyncFetchArgs): string {
    const c = args.cursor;
    // Xero's `where` parser expects unpadded integer components.
    // `DateTime(2026,03,22,...)` silently returns 0 invoices;
    // `DateTime(2026,3,22,...)` works. Known Xero API footgun.
    const dateTime =
      `DateTime(${c.getUTCFullYear()},` +
      `${c.getUTCMonth() + 1},` +
      `${c.getUTCDate()},` +
      `${c.getUTCHours()},` +
      `${c.getUTCMinutes()},` +
      `${c.getUTCSeconds()})`;

    const where = `Type=="ACCREC" AND UpdatedDateUTC>${dateTime}`;
    const page = Math.floor(args.offset / 100) + 1;
    const statuses = SYNCABLE_STATUSES.map(encodeURIComponent).join(",");

    return (
      `${XERO_BASE}/Invoices` +
      `?where=${encodeURIComponent(where)}&Statuses=${statuses}&page=${page}`
    );
  }

  private buildContactsUrl(contactIds: string[]): string {
    return (
      `${XERO_BASE}/Contacts` +
      `?IDs=${encodeURIComponent(contactIds.join(","))}`
    );
  }

  private commonHeaders(args: InvoiceSyncFetchArgs): Record<string, string> {
    return {
      Authorization: `Bearer ${args.tokens.accessToken}`,
      "xero-tenant-id": args.tenantId,
      Accept: "application/json",
    };
  }

  private async get<T>(
    url: string,
    headers: Record<string, string>,
    label: string,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers });
    } catch (cause) {
      throw new SyncFailedError(cause);
    }

    if (res.status === 401) throw new AuthError();
    if (res.status === 429) {
      const hdr = res.headers.get("retry-after");
      const parsed = hdr ? Number(hdr) : NaN;
      const retryAfterMs =
        Number.isFinite(parsed) && parsed >= 0
          ? parsed * 1000
          : DEFAULT_RETRY_AFTER_MS;
      throw new RateLimitError(retryAfterMs);
    }
    if (!res.ok) {
      throw new SyncFailedError(`Xero ${label} request failed: HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  private async fetchInvoices(args: InvoiceSyncFetchArgs): Promise<XeroInvoice[]> {
    const url = this.buildInvoiceUrl(args);
    const body = await this.get<{ Invoices?: XeroInvoice[] }>(
      url,
      this.commonHeaders(args),
      "Invoices",
    );
    return body.Invoices ?? [];
  }

  private async fetchContacts(
    args: InvoiceSyncFetchArgs,
    contactIds: string[],
  ): Promise<XeroContact[]> {
    const url = this.buildContactsUrl(contactIds);
    const body = await this.get<{ Contacts?: XeroContact[] }>(
      url,
      this.commonHeaders(args),
      "Contacts",
    );
    return body.Contacts ?? [];
  }

  private async fetchOnlineInvoiceUrl(
    tokens: ProviderTokens,
    tenantId: string,
    invoiceId: string,
  ): Promise<string | null> {
    const url = `${XERO_BASE}/Invoices/${encodeURIComponent(invoiceId)}/OnlineInvoice`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    };

    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers });
    } catch (cause) {
      this.logger.warn({
        msg: "OnlineInvoice fetch failed (network error); leaving paymentLinkUrl null",
        event: "xero_online_invoice_fetch_network_error",
        invoiceId,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }

    // 401 propagates to trigger the use-case refresh flow
    if (res.status === 401) throw new AuthError();

    if (!res.ok) {
      this.logger.warn({
        msg: "OnlineInvoice fetch returned non-OK status; leaving paymentLinkUrl null",
        event: "xero_online_invoice_fetch_error",
        invoiceId,
        status: res.status,
      });
      return null;
    }

    const body = (await res.json()) as {
      OnlineInvoices?: { OnlineInvoiceUrl?: string }[];
    };
    return body.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;
  }
}
