import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ProviderName } from "@nudge/connections-domain";
import { Env } from "../../../common/config/env.schema";
import type {
  CanonicalCustomer,
  CanonicalInvoice,
  CanonicalInvoiceLifecycle,
} from "../domain/canonical-invoice";
import {
  AuthError,
  InvoiceSyncFetchArgs,
  InvoiceSyncPage,
  InvoiceSyncProvider,
  RateLimitError,
  SyncFailedError,
} from "../domain/invoice-sync.provider";

const PROD_BASE = "https://quickbooks.api.intuit.com";
const SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com";
const MINOR_VERSION = "73";
const DEFAULT_RETRY_AFTER_MS = 30_000;

type QBInvoice = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  CurrencyRef?: { value: string };
  CustomerRef: { value: string };
  MetaData?: { LastUpdatedTime?: string };
  TxnStatus?: string;
};

type QBCustomer = {
  Id: string;
  DisplayName?: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
};

type QBQueryResponse<TKey extends string, T> = {
  QueryResponse?: Partial<{ [K in TKey]: T[] }> & {
    startPosition?: number;
    maxResults?: number;
  };
};

@Injectable()
export class QuickbooksInvoiceSyncProvider implements InvoiceSyncProvider {
  readonly name: ProviderName = "quickbooks";

  constructor(private readonly config: ConfigService<Env, true>) {}

  private baseUrl(): string {
    const env = this.config.get("QUICKBOOKS_ENVIRONMENT", { infer: true });
    return env === "production" ? PROD_BASE : SANDBOX_BASE;
  }

  async fetchPage(args: InvoiceSyncFetchArgs): Promise<InvoiceSyncPage> {
    const invoiceRows = await this.runQuery<QBInvoice>(
      args,
      this.invoiceQuery(args.cursor, args.offset, args.pageSize),
      "Invoice",
    );

    const customerExtIds = Array.from(
      new Set(invoiceRows.map((i) => i.CustomerRef.value)),
    );
    const customerRows = customerExtIds.length
      ? await this.runQuery<QBCustomer>(
          args,
          this.customerQuery(customerExtIds),
          "Customer",
        )
      : [];

    const invoices: CanonicalInvoice[] = invoiceRows.map((r) =>
      this.mapInvoice(r),
    );
    const customers: CanonicalCustomer[] = customerRows.map((r) =>
      this.mapCustomer(r),
    );

    return {
      invoices,
      customers,
      hasMore: invoiceRows.length === args.pageSize,
    };
  }

  private invoiceQuery(cursor: Date, offset: number, pageSize: number): string {
    const cursorIso = cursor.toISOString();
    const startPosition = offset + 1;
    return (
      `SELECT * FROM Invoice ` +
      `WHERE MetaData.LastUpdatedTime > '${cursorIso}' ` +
      `ORDER BY MetaData.LastUpdatedTime ` +
      `STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`
    );
  }

  private customerQuery(ids: string[]): string {
    const quoted = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
    return `SELECT * FROM Customer WHERE Id IN (${quoted})`;
  }

  private async runQuery<T>(
    args: InvoiceSyncFetchArgs,
    query: string,
    key: "Invoice" | "Customer",
  ): Promise<T[]> {
    const url =
      `${this.baseUrl()}/v3/company/${encodeURIComponent(args.tenantId)}/query` +
      `?query=${encodeURIComponent(query)}&minorversion=${MINOR_VERSION}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${args.tokens.accessToken}`,
          Accept: "application/json",
        },
      });
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
      throw new SyncFailedError(`QB ${key} query failed: HTTP ${res.status}`);
    }

    const body = (await res.json()) as QBQueryResponse<typeof key, T>;
    return body.QueryResponse?.[key] ?? [];
  }

  private mapInvoice(r: QBInvoice): CanonicalInvoice {
    const amountCents = Math.round((r.TotalAmt ?? 0) * 100);
    const balanceDueCents = Math.round((r.Balance ?? 0) * 100);
    const amountPaidCents = Math.max(0, amountCents - balanceDueCents);
    const lifecycle: CanonicalInvoiceLifecycle =
      r.TxnStatus === "Voided" ? "voided" : "active";
    return {
      externalId: r.Id,
      invoiceNumber: r.DocNumber ?? null,
      customerExternalId: r.CustomerRef.value,
      amountCents,
      amountPaidCents,
      balanceDueCents,
      currency: r.CurrencyRef?.value ?? "USD",
      issuedDate: r.TxnDate ? new Date(r.TxnDate) : null,
      dueDate: new Date(r.DueDate ?? r.TxnDate ?? new Date()),
      lifecycle,
      lastUpdatedAt: new Date(
        r.MetaData?.LastUpdatedTime ?? new Date().toISOString(),
      ),
    };
  }

  private mapCustomer(r: QBCustomer): CanonicalCustomer {
    const companyName =
      r.CompanyName?.trim() || r.DisplayName?.trim() || `Customer ${r.Id}`;
    const nameParts = [r.GivenName, r.FamilyName].filter(Boolean).join(" ").trim();
    const contactName = nameParts || r.DisplayName || null;
    return {
      externalId: r.Id,
      companyName,
      contactName: contactName || null,
      contactEmail: r.PrimaryEmailAddr?.Address ?? null,
      contactPhone: r.PrimaryPhone?.FreeFormNumber ?? null,
    };
  }
}
