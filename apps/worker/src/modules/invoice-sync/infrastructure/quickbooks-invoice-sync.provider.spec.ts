import { ConfigService } from "@nestjs/config";
import type { ProviderTokens } from "@nudge/connections-domain";
import { Env } from "../../../common/config/env.schema";
import {
  AuthError,
  RateLimitError,
  SyncFailedError,
} from "../domain/invoice-sync.provider";
import { QuickbooksInvoiceSyncProvider } from "./quickbooks-invoice-sync.provider";

const config = {
  get: jest.fn((key: string) => {
    if (key === "QUICKBOOKS_ENVIRONMENT") return "sandbox";
    return "";
  }),
} as unknown as ConfigService<Env, true>;

const tokens: ProviderTokens = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: new Date(Date.now() + 3_600_000),
};

const invoiceResponse = (items: unknown[], maxResults = items.length) => ({
  QueryResponse: {
    Invoice: items,
    startPosition: 1,
    maxResults,
  },
  time: "2026-04-21T00:00:00Z",
});

const customerResponse = (items: unknown[]) => ({
  QueryResponse: {
    Customer: items,
    startPosition: 1,
    maxResults: items.length,
  },
  time: "2026-04-21T00:00:00Z",
});

const sampleInvoice = {
  Id: "1001",
  DocNumber: "INV-1001",
  TxnDate: "2026-01-01",
  DueDate: "2026-02-01",
  TotalAmt: 500.25,
  Balance: 200.25,
  CurrencyRef: { value: "USD" },
  CustomerRef: { value: "C1", name: "Acme" },
  MetaData: {
    CreateTime: "2026-01-01T00:00:00Z",
    LastUpdatedTime: "2026-01-05T10:00:00Z",
  },
  TxnStatus: "Payable",
};

const sampleCustomer = {
  Id: "C1",
  DisplayName: "Acme Co.",
  CompanyName: "Acme Co.",
  GivenName: "Jane",
  FamilyName: "Doe",
  PrimaryEmailAddr: { Address: "jane@acme.test" },
  PrimaryPhone: { FreeFormNumber: "+1-555-0000" },
};

describe("QuickbooksInvoiceSyncProvider", () => {
  let provider: QuickbooksInvoiceSyncProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new QuickbooksInvoiceSyncProvider(config);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("maps a QB invoice response to CanonicalInvoice (field-by-field)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoiceResponse([sampleInvoice])))
      .mockResolvedValueOnce(ok(customerResponse([sampleCustomer])));

    const page = await provider.fetchPage({
      tokens,
      tenantId: "realm-1",
      cursor: new Date("2026-01-01T00:00:00Z"),
      offset: 0,
      pageSize: 1000,
    });

    expect(page.invoices).toEqual([
      {
        externalId: "1001",
        invoiceNumber: "INV-1001",
        customerExternalId: "C1",
        amountCents: 50025,
        amountPaidCents: 30000,
        balanceDueCents: 20025,
        currency: "USD",
        issuedDate: new Date("2026-01-01"),
        dueDate: new Date("2026-02-01"),
        lifecycle: "active",
        lastUpdatedAt: new Date("2026-01-05T10:00:00Z"),
      },
    ]);
    expect(page.hasMore).toBe(false);
  });

  it("sets lifecycle='voided' when TxnStatus='Voided'", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok(invoiceResponse([{ ...sampleInvoice, TxnStatus: "Voided" }])),
      )
      .mockResolvedValueOnce(ok(customerResponse([sampleCustomer])));

    const page = await provider.fetchPage({
      tokens,
      tenantId: "realm-1",
      cursor: new Date("2026-01-01T00:00:00Z"),
      offset: 0,
      pageSize: 1000,
    });

    expect(page.invoices[0].lifecycle).toBe("voided");
  });

  it("defaults currency to USD when CurrencyRef is absent", async () => {
    const { CurrencyRef: _cr, ...invoiceNoCurr } = sampleInvoice;
    void _cr;
    fetchMock
      .mockResolvedValueOnce(ok(invoiceResponse([invoiceNoCurr])))
      .mockResolvedValueOnce(ok(customerResponse([sampleCustomer])));

    const page = await provider.fetchPage({
      tokens,
      tenantId: "realm-1",
      cursor: new Date("2026-01-01T00:00:00Z"),
      offset: 0,
      pageSize: 1000,
    });
    expect(page.invoices[0].currency).toBe("USD");
  });

  it("collects unique CustomerRef.value IDs and makes one batched Customer query", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok(
          invoiceResponse([
            { ...sampleInvoice, Id: "1", CustomerRef: { value: "C1" } },
            { ...sampleInvoice, Id: "2", CustomerRef: { value: "C2" } },
            { ...sampleInvoice, Id: "3", CustomerRef: { value: "C1" } },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        ok(
          customerResponse([
            { ...sampleCustomer, Id: "C1" },
            { ...sampleCustomer, Id: "C2" },
          ]),
        ),
      );

    await provider.fetchPage({
      tokens,
      tenantId: "realm-1",
      cursor: new Date("2026-01-01"),
      offset: 0,
      pageSize: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const customerUrl = fetchMock.mock.calls[1][0] as string;
    expect(decodeURIComponent(customerUrl)).toContain(
      "SELECT * FROM Customer WHERE Id IN ('C1','C2')",
    );
  });

  it("hasMore is true when page size == 1000, false otherwise", async () => {
    const thousand = Array.from({ length: 1000 }, (_, i) => ({
      ...sampleInvoice,
      Id: String(i + 1),
      CustomerRef: { value: "C1" },
    }));
    fetchMock
      .mockResolvedValueOnce(ok(invoiceResponse(thousand, 1000)))
      .mockResolvedValueOnce(ok(customerResponse([sampleCustomer])));
    const page = await provider.fetchPage({
      tokens,
      tenantId: "realm-1",
      cursor: new Date("2026-01-01"),
      offset: 0,
      pageSize: 1000,
    });
    expect(page.hasMore).toBe(true);
  });

  it("maps 401 → AuthError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ Fault: { Error: [{ code: "401" }] } }), {
        status: 401,
      }),
    );
    await expect(
      provider.fetchPage({
        tokens,
        tenantId: "realm-1",
        cursor: new Date("2026-01-01"),
        offset: 0,
        pageSize: 1000,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 429 with Retry-After header → RateLimitError(retryAfterMs)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("", {
        status: 429,
        headers: { "retry-after": "5" },
      }),
    );
    try {
      await provider.fetchPage({
        tokens,
        tenantId: "realm-1",
        cursor: new Date("2026-01-01"),
        offset: 0,
        pageSize: 1000,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(5000);
    }
  });

  it("maps 429 without Retry-After → RateLimitError(30_000)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    try {
      await provider.fetchPage({
        tokens,
        tenantId: "realm-1",
        cursor: new Date("2026-01-01"),
        offset: 0,
        pageSize: 1000,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("maps 500 → SyncFailedError", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(
      provider.fetchPage({
        tokens,
        tenantId: "realm-1",
        cursor: new Date("2026-01-01"),
        offset: 0,
        pageSize: 1000,
      }),
    ).rejects.toBeInstanceOf(SyncFailedError);
  });
});
