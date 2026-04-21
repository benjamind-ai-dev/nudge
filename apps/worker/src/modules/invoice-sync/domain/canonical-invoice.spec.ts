import type { CanonicalInvoice } from "./canonical-invoice";
import { deriveStatus } from "./canonical-invoice";

const baseInvoice = (overrides: Partial<CanonicalInvoice> = {}): CanonicalInvoice => ({
  externalId: "inv_1",
  invoiceNumber: "1001",
  customerExternalId: "cust_1",
  amountCents: 10_000,
  amountPaidCents: 0,
  balanceDueCents: 10_000,
  currency: "USD",
  paymentLinkUrl: null,
  issuedDate: new Date("2026-01-01"),
  dueDate: new Date("2026-02-01"),
  lifecycle: "active",
  lastUpdatedAt: new Date("2026-01-02"),
  ...overrides,
});

describe("deriveStatus", () => {
  const now = new Date("2026-04-21T12:00:00Z");

  it("returns 'voided' when lifecycle is voided, regardless of balance", () => {
    const inv = baseInvoice({ lifecycle: "voided", balanceDueCents: 5_000 });
    expect(deriveStatus(inv, now)).toBe("voided");
  });

  it("returns 'paid' when balanceDueCents is 0", () => {
    const inv = baseInvoice({ balanceDueCents: 0, amountPaidCents: 10_000 });
    expect(deriveStatus(inv, now)).toBe("paid");
  });

  it("returns 'paid' when balanceDueCents is negative (overpayment)", () => {
    const inv = baseInvoice({ balanceDueCents: -500, amountPaidCents: 10_500 });
    expect(deriveStatus(inv, now)).toBe("paid");
  });

  it("returns 'partial' when 0 < balance < amount", () => {
    const inv = baseInvoice({ balanceDueCents: 3_000, amountPaidCents: 7_000 });
    expect(deriveStatus(inv, now)).toBe("partial");
  });

  it("returns 'overdue' when balance equals amount and dueDate is in the past", () => {
    const inv = baseInvoice({ dueDate: new Date("2026-04-20") });
    expect(deriveStatus(inv, now)).toBe("overdue");
  });

  it("returns 'open' when balance equals amount and dueDate is in the future", () => {
    const inv = baseInvoice({ dueDate: new Date("2026-05-01") });
    expect(deriveStatus(inv, now)).toBe("open");
  });

  it("returns 'open' when dueDate equals now (not overdue until strictly past)", () => {
    const inv = baseInvoice({ dueDate: now });
    expect(deriveStatus(inv, now)).toBe("open");
  });
});
