import type { ProviderTokens } from "@nudge/connections-domain";
import {
  AuthError,
  RateLimitError,
  SyncFailedError,
} from "../domain/invoice-sync.provider";
import {
  mapXeroCustomer,
  mapXeroInvoice,
  XeroInvoiceSyncProvider,
} from "./xero-invoice-sync.provider";

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const tokens: ProviderTokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: new Date(Date.now() + 3_600_000),
};

const BASE_ARGS = {
  tokens,
  tenantId: "tenant-uuid-123",
  cursor: new Date("2026-01-05T10:00:00Z"),
  offset: 0,
  pageSize: 100,
};

const sampleXeroInvoice = {
  InvoiceID: "inv-aaa",
  InvoiceNumber: "INV-001",
  Type: "ACCREC",
  Status: "AUTHORISED",
  Total: 500.25,
  AmountDue: 200.25,
  AmountPaid: 300.0,
  Date: "2026-01-01",
  DueDate: "2026-02-01",
  UpdatedDateUTC: "/Date(1736071200000+0000)/",
  Contact: { ContactID: "contact-1", Name: "Acme Corp" },
  CurrencyCode: "USD",
};

const sampleXeroContact = {
  ContactID: "contact-1",
  Name: "Acme Corp",
  FirstName: "Jane",
  LastName: "Doe",
  EmailAddress: "jane@acme.test",
  Phones: [
    { PhoneType: "DEFAULT", PhoneNumber: "5550000", PhoneAreaCode: "555", PhoneCountryCode: "1" },
    { PhoneType: "MOBILE", PhoneNumber: "5559999", PhoneAreaCode: "555", PhoneCountryCode: "1" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// A. Mapper unit tests — no HTTP
// ─────────────────────────────────────────────────────────────────────────────

describe("mapXeroInvoice", () => {
  it("maps all fields of a canonical example correctly", () => {
    const result = mapXeroInvoice(sampleXeroInvoice);

    expect(result.externalId).toBe("inv-aaa");
    expect(result.invoiceNumber).toBe("INV-001");
    expect(result.customerExternalId).toBe("contact-1");
    expect(result.amountCents).toBe(50025);
    expect(result.balanceDueCents).toBe(20025);
    expect(result.amountPaidCents).toBe(30000);
    expect(result.currency).toBe("USD");
    expect(result.paymentLinkUrl).toBeNull();
    expect(result.issuedDate).toEqual(new Date("2026-01-01"));
    expect(result.dueDate).toEqual(new Date("2026-02-01"));
    expect(result.lifecycle).toBe("active");
    // /Date(1736071200000+0000)/ → new Date(1736071200000)
    expect(result.lastUpdatedAt).toEqual(new Date(1736071200000));
  });

  it("Status VOIDED → lifecycle 'voided'", () => {
    const result = mapXeroInvoice({ ...sampleXeroInvoice, Status: "VOIDED" });
    expect(result.lifecycle).toBe("voided");
  });

  it("Status DELETED → lifecycle 'voided'", () => {
    const result = mapXeroInvoice({ ...sampleXeroInvoice, Status: "DELETED" });
    expect(result.lifecycle).toBe("voided");
  });

  it.each(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID"])(
    "Status %s → lifecycle 'active'",
    (status) => {
      const result = mapXeroInvoice({ ...sampleXeroInvoice, Status: status });
      expect(result.lifecycle).toBe("active");
    },
  );

  it("CurrencyCode absent → defaults to 'USD'", () => {
    const { CurrencyCode: _cc, ...noCurrency } = sampleXeroInvoice;
    void _cc;
    const result = mapXeroInvoice(noCurrency as typeof sampleXeroInvoice);
    expect(result.currency).toBe("USD");
  });

  it("AmountDue absent → balanceDueCents=0, amountPaidCents=amountCents", () => {
    const { AmountDue: _ad, ...noAmountDue } = sampleXeroInvoice;
    void _ad;
    const result = mapXeroInvoice(noAmountDue as typeof sampleXeroInvoice);
    expect(result.balanceDueCents).toBe(0);
    expect(result.amountPaidCents).toBe(result.amountCents);
  });

  it("DueDate absent → falls back to issuedDate", () => {
    const { DueDate: _dd, ...noDueDate } = sampleXeroInvoice;
    void _dd;
    const result = mapXeroInvoice(noDueDate as typeof sampleXeroInvoice);
    expect(result.dueDate).toEqual(new Date("2026-01-01"));
  });

  it("DueDate and Date both absent → falls back to new Date()", () => {
    const before = Date.now();
    const { DueDate: _dd, Date: _d, ...noDates } = sampleXeroInvoice;
    void _dd;
    void _d;
    const result = mapXeroInvoice(noDates as typeof sampleXeroInvoice);
    const after = Date.now();
    expect(result.dueDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.dueDate.getTime()).toBeLessThanOrEqual(after);
  });

  it("UpdatedDateUTC absent → lastUpdatedAt is approximately now", () => {
    const before = Date.now();
    const { UpdatedDateUTC: _u, ...noUpdated } = sampleXeroInvoice;
    void _u;
    const result = mapXeroInvoice(noUpdated as typeof sampleXeroInvoice);
    const after = Date.now();
    expect(result.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.lastUpdatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("InvoiceNumber absent → invoiceNumber is null", () => {
    const { InvoiceNumber: _in, ...noNumber } = sampleXeroInvoice;
    void _in;
    const result = mapXeroInvoice(noNumber as typeof sampleXeroInvoice);
    expect(result.invoiceNumber).toBeNull();
  });
});

describe("mapXeroCustomer", () => {
  it("maps all fields of a canonical example correctly", () => {
    const result = mapXeroCustomer(sampleXeroContact);

    expect(result.externalId).toBe("contact-1");
    expect(result.companyName).toBe("Acme Corp");
    expect(result.contactName).toBe("Jane Doe");
    expect(result.contactEmail).toBe("jane@acme.test");
    expect(result.contactPhone).toBe("5550000");
  });

  it("contactName: only FirstName present", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      LastName: undefined,
    });
    expect(result.contactName).toBe("Jane");
  });

  it("contactName: both FirstName and LastName missing → falls back to Name", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      FirstName: undefined,
      LastName: undefined,
      Name: "Acme Corp",
    });
    expect(result.contactName).toBe("Acme Corp");
  });

  it("companyName falls back to 'Customer <ContactID>' when Name is absent", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      Name: undefined,
      ContactID: "xyz-999",
    });
    expect(result.companyName).toBe("Customer xyz-999");
  });

  it("contactEmail is null when EmailAddress is absent", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      EmailAddress: undefined,
    });
    expect(result.contactEmail).toBeNull();
  });

  it("contactPhone prefers DEFAULT PhoneType when multiple phones exist", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      Phones: [
        { PhoneType: "MOBILE", PhoneNumber: "9999999" },
        { PhoneType: "DEFAULT", PhoneNumber: "1111111" },
      ],
    });
    expect(result.contactPhone).toBe("1111111");
  });

  it("contactPhone picks first non-empty when no DEFAULT type", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      Phones: [
        { PhoneType: "FAX", PhoneNumber: "" },
        { PhoneType: "MOBILE", PhoneNumber: "7777777" },
      ],
    });
    expect(result.contactPhone).toBe("7777777");
  });

  it("contactPhone is null when Phones is absent", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      Phones: undefined,
    });
    expect(result.contactPhone).toBeNull();
  });

  it("contactPhone is null when all phones have empty PhoneNumber", () => {
    const result = mapXeroCustomer({
      ...sampleXeroContact,
      Phones: [
        { PhoneType: "DEFAULT", PhoneNumber: "" },
        { PhoneType: "MOBILE", PhoneNumber: "" },
      ],
    });
    expect(result.contactPhone).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Provider HTTP integration tests — global.fetch mocked
// ─────────────────────────────────────────────────────────────────────────────

const invoicePageResponse = (items: unknown[]) => ({
  Invoices: items,
});

const contactsResponse = (items: unknown[]) => ({
  Contacts: items,
});

describe("XeroInvoiceSyncProvider", () => {
  let provider: XeroInvoiceSyncProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new XeroInvoiceSyncProvider();
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

  const onlineInvoiceResponse = (url: string) => ({
    OnlineInvoices: [{ OnlineInvoiceUrl: url }],
  });

  it("happy path: fetches invoices + contacts and returns correct CanonicalInvoice and CanonicalCustomer", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    const page = await provider.fetchPage(BASE_ARGS);

    expect(page.invoices).toHaveLength(1);
    expect(page.invoices[0].externalId).toBe("inv-aaa");
    expect(page.invoices[0].amountCents).toBe(50025);
    expect(page.customers).toHaveLength(1);
    expect(page.customers[0].externalId).toBe("contact-1");
    expect(page.hasMore).toBe(false);
  });

  it("invoice URL includes encoded 'where' filter with cursor date components", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    await provider.fetchPage(BASE_ARGS);

    const invoiceUrl = fetchMock.mock.calls[0][0] as string;
    const decoded = decodeURIComponent(invoiceUrl);

    expect(decoded).toContain('Type=="ACCREC"');
    expect(decoded).toContain("UpdatedDateUTC>DateTime(2026,01,05,10,00,00)");
    expect(decoded).toContain("page=1");
    expect(invoiceUrl).toContain("Statuses=AUTHORISED,PAID,VOIDED,DELETED");
  });

  it("sends xero-tenant-id header on invoice request", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    await provider.fetchPage(BASE_ARGS);

    const invoiceInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = invoiceInit.headers as Record<string, string>;
    expect(headers["xero-tenant-id"]).toBe("tenant-uuid-123");
  });

  it("offset=0 → page=1 in URL", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    await provider.fetchPage({ ...BASE_ARGS, offset: 0 });

    const invoiceUrl = fetchMock.mock.calls[0][0] as string;
    expect(invoiceUrl).toContain("page=1");
  });

  it("offset=100 → page=2 in URL", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    await provider.fetchPage({ ...BASE_ARGS, offset: 100 });

    const invoiceUrl = fetchMock.mock.calls[0][0] as string;
    expect(invoiceUrl).toContain("page=2");
  });

  it("hasMore is true when returned invoice array length === 100", async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      ...sampleXeroInvoice,
      InvoiceID: `inv-${i}`,
      Contact: { ContactID: "contact-1" },
    }));
    // Each AUTHORISED invoice triggers an OnlineInvoice fetch
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse(hundred)))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])));
    // 100 OnlineInvoice fetches
    for (let i = 0; i < 100; i++) {
      fetchMock.mockResolvedValueOnce(ok(onlineInvoiceResponse(`https://in.xero.com/view/inv-${i}`)));
    }

    const page = await provider.fetchPage(BASE_ARGS);
    expect(page.hasMore).toBe(true);
  });

  it("hasMore is false when returned invoice array length < 100", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    const page = await provider.fetchPage(BASE_ARGS);
    expect(page.hasMore).toBe(false);
  });

  it("hasMore is false when 99 invoices returned (just under the 100 cap)", async () => {
    const ninetyNine = Array.from({ length: 99 }, (_, i) => ({
      ...sampleXeroInvoice,
      InvoiceID: `inv-${i + 1}`,
      Contact: { ContactID: "contact-1" },
    }));
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse(ninetyNine)))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])));
    // 99 OnlineInvoice fetches
    for (let i = 0; i < 99; i++) {
      fetchMock.mockResolvedValueOnce(ok(onlineInvoiceResponse(`https://in.xero.com/view/inv-${i + 1}`)));
    }

    const page = await provider.fetchPage({
      tokens,
      tenantId: "tenant-1",
      cursor: new Date("2026-01-01T00:00:00Z"),
      offset: 0,
      pageSize: 1000,
    });

    expect(page.hasMore).toBe(false);
  });

  it("batches unique Contact IDs: 3 invoices with 2 unique IDs → contacts URL uses both IDs", async () => {
    const invoices = [
      { ...sampleXeroInvoice, InvoiceID: "i1", Contact: { ContactID: "contact-A" } },
      { ...sampleXeroInvoice, InvoiceID: "i2", Contact: { ContactID: "contact-B" } },
      { ...sampleXeroInvoice, InvoiceID: "i3", Contact: { ContactID: "contact-A" } },
    ];
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse(invoices)))
      .mockResolvedValueOnce(
        ok(
          contactsResponse([
            { ...sampleXeroContact, ContactID: "contact-A" },
            { ...sampleXeroContact, ContactID: "contact-B" },
          ]),
        ),
      )
      // 3 AUTHORISED invoices → 3 OnlineInvoice fetches
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/i1")))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/i2")))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/i3")));

    await provider.fetchPage(BASE_ARGS);

    // calls: invoices + contacts + 3 online invoice fetches = 5
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const contactUrl = fetchMock.mock.calls[1][0] as string;
    const decoded = decodeURIComponent(contactUrl);
    expect(decoded).toContain("contact-A");
    expect(decoded).toContain("contact-B");
    // Unique only — the same ID should not appear twice
    expect((decoded.match(/contact-A/g) ?? []).length).toBe(1);
  });

  it("401 → AuthError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ Type: "ValidationException" }), { status: 401 }),
    );
    await expect(provider.fetchPage(BASE_ARGS)).rejects.toBeInstanceOf(AuthError);
  });

  it("429 with Retry-After: 5 → RateLimitError(5000)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "5" } }),
    );
    try {
      await provider.fetchPage(BASE_ARGS);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(5000);
    }
  });

  it("429 without Retry-After → RateLimitError(30_000)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    try {
      await provider.fetchPage(BASE_ARGS);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("500 → SyncFailedError", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(provider.fetchPage(BASE_ARGS)).rejects.toBeInstanceOf(SyncFailedError);
  });

  it("network/fetch throw → SyncFailedError", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(provider.fetchPage(BASE_ARGS)).rejects.toBeInstanceOf(SyncFailedError);
  });

  it("empty invoice page → no contacts call is made, returns empty arrays", async () => {
    fetchMock.mockResolvedValueOnce(ok(invoicePageResponse([])));

    const page = await provider.fetchPage(BASE_ARGS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.invoices).toHaveLength(0);
    expect(page.customers).toHaveLength(0);
    expect(page.hasMore).toBe(false);
  });

  it("URL includes Statuses filter excluding DRAFT and SUBMITTED", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    await provider.fetchPage({
      tokens,
      tenantId: "tenant-1",
      cursor: new Date("2026-01-05T10:00:00Z"),
      offset: 0,
      pageSize: 1000,
    });

    const invoiceUrl = fetchMock.mock.calls[0][0] as string;
    expect(invoiceUrl).toContain("Statuses=AUTHORISED,PAID,VOIDED,DELETED");
    expect(invoiceUrl).not.toContain("DRAFT");
    expect(invoiceUrl).not.toContain("SUBMITTED");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OnlineInvoiceUrl tests
  // ─────────────────────────────────────────────────────────────────────────

  it("OnlineInvoiceUrl is fetched for AUTHORISED invoice and attached to canonical", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(ok(onlineInvoiceResponse("https://in.xero.com/view/abc")));

    const page = await provider.fetchPage(BASE_ARGS);

    expect(page.invoices[0].paymentLinkUrl).toBe("https://in.xero.com/view/abc");
    const onlineInvoiceUrl = fetchMock.mock.calls[2][0] as string;
    expect(onlineInvoiceUrl).toContain("/OnlineInvoice");
    expect(onlineInvoiceUrl).toContain("inv-aaa");
  });

  it("OnlineInvoiceUrl is NOT fetched for non-AUTHORISED invoices (PAID)", async () => {
    const paidInvoice = { ...sampleXeroInvoice, Status: "PAID" };
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([paidInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])));

    const page = await provider.fetchPage(BASE_ARGS);

    // Only 2 calls: invoices + contacts — no OnlineInvoice fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.invoices[0].paymentLinkUrl).toBeNull();
    const allUrls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(allUrls.every((u) => !u.includes("OnlineInvoice"))).toBe(true);
  });

  it("OnlineInvoice fetch failure (500) is swallowed — paymentLinkUrl is null, sync continues", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    const page = await provider.fetchPage(BASE_ARGS);

    expect(page.invoices[0].paymentLinkUrl).toBeNull();
    expect(page.invoices).toHaveLength(1);
  });

  it("OnlineInvoice fetch failure (network error) is swallowed — paymentLinkUrl is null, sync continues", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockRejectedValueOnce(new Error("network down"));

    const page = await provider.fetchPage(BASE_ARGS);

    expect(page.invoices[0].paymentLinkUrl).toBeNull();
    expect(page.invoices).toHaveLength(1);
  });

  it("OnlineInvoice 401 propagates as AuthError (triggers refresh flow)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(invoicePageResponse([sampleXeroInvoice])))
      .mockResolvedValueOnce(ok(contactsResponse([sampleXeroContact])))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    await expect(provider.fetchPage(BASE_ARGS)).rejects.toBeInstanceOf(AuthError);
  });
});
