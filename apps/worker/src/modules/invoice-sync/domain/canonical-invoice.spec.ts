import type { CanonicalInvoice, PriorInvoiceState } from "./canonical-invoice";
import { deriveStatus, detectInvoiceTransition } from "./canonical-invoice";

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

describe("detectInvoiceTransition", () => {
  const now = new Date("2026-04-21T12:00:00Z");

  const next = (overrides: Partial<CanonicalInvoice> = {}): CanonicalInvoice =>
    baseInvoice(overrides);

  it("returns new_invoice when there is no prior state", () => {
    const t = detectInvoiceTransition(undefined, next(), now);
    expect(t).toEqual({ kind: "new_invoice" });
  });

  it("returns no_change when prior is voided", () => {
    const prior: PriorInvoiceState = { status: "voided", balanceDueCents: 0 };
    const t = detectInvoiceTransition(prior, next({ lifecycle: "voided" }), now);
    expect(t).toEqual({ kind: "no_change" });
  });

  it("returns no_change when prior is paid (no unwind)", () => {
    const prior: PriorInvoiceState = { status: "paid", balanceDueCents: 0 };
    const t = detectInvoiceTransition(prior, next({ balanceDueCents: 5_000 }), now);
    expect(t).toEqual({ kind: "no_change" });
  });

  it("returns no_change when prior is paid and provider sends voided", () => {
    const prior: PriorInvoiceState = { status: "paid", balanceDueCents: 0 };
    const t = detectInvoiceTransition(
      prior,
      next({ lifecycle: "voided", balanceDueCents: 0 }),
      now,
    );
    expect(t).toEqual({ kind: "no_change" });
  });

  it("returns voided when prior is open and lifecycle is voided", () => {
    const prior: PriorInvoiceState = { status: "open", balanceDueCents: 8_400 };
    const t = detectInvoiceTransition(
      prior,
      next({ lifecycle: "voided", balanceDueCents: 8_400 }),
      now,
    );
    expect(t).toEqual({ kind: "voided", priorBalance: 8_400, priorStatus: "open" });
  });

  it("returns fully_paid when prior is overdue and balance hits 0", () => {
    const prior: PriorInvoiceState = { status: "overdue", balanceDueCents: 8_400 };
    const t = detectInvoiceTransition(
      prior,
      next({ balanceDueCents: 0, amountPaidCents: 10_000 }),
      now,
    );
    expect(t).toEqual({ kind: "fully_paid", priorBalance: 8_400 });
  });

  it("returns fully_paid when prior is partial and balance hits 0", () => {
    const prior: PriorInvoiceState = { status: "partial", balanceDueCents: 2_000 };
    const t = detectInvoiceTransition(
      prior,
      next({ balanceDueCents: 0, amountPaidCents: 10_000 }),
      now,
    );
    expect(t).toEqual({ kind: "fully_paid", priorBalance: 2_000 });
  });

  it("returns partial_payment when prior is open and balance decreases but > 0", () => {
    const prior: PriorInvoiceState = { status: "open", balanceDueCents: 10_000 };
    const t = detectInvoiceTransition(
      prior,
      next({ balanceDueCents: 4_000, amountPaidCents: 6_000 }),
      now,
    );
    expect(t).toEqual({
      kind: "partial_payment",
      priorBalance: 10_000,
      newBalance: 4_000,
    });
  });

  it("returns partial_payment when prior is partial and balance decreases further", () => {
    const prior: PriorInvoiceState = { status: "partial", balanceDueCents: 4_000 };
    const t = detectInvoiceTransition(
      prior,
      next({ balanceDueCents: 1_000, amountPaidCents: 9_000 }),
      now,
    );
    expect(t).toEqual({
      kind: "partial_payment",
      priorBalance: 4_000,
      newBalance: 1_000,
    });
  });

  it("returns balance_changed when balance increased (rare)", () => {
    const prior: PriorInvoiceState = { status: "open", balanceDueCents: 10_000 };
    const t = detectInvoiceTransition(
      prior,
      next({ balanceDueCents: 12_000, amountCents: 12_000 }),
      now,
    );
    expect(t).toEqual({
      kind: "balance_changed",
      priorBalance: 10_000,
      newBalance: 12_000,
    });
  });

  it("returns no_change when balance unchanged and not voided", () => {
    const prior: PriorInvoiceState = { status: "overdue", balanceDueCents: 10_000 };
    const t = detectInvoiceTransition(prior, next({ balanceDueCents: 10_000 }), now);
    expect(t).toEqual({ kind: "no_change" });
  });
});
