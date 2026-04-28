import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import {
  SEQUENCE_RUN_STATUSES,
  STOPPED_REASONS,
  type SequenceRunStatus,
} from "@nudge/shared";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  CanonicalInvoice,
  InvoiceStatus,
  InvoiceTransition,
} from "../domain/canonical-invoice";
import {
  SEQUENCE_RUN_REPOSITORY,
  type InvoiceChange,
} from "../domain/repositories";
import { PrismaInvoiceRepository } from "./prisma-invoice.repository";
import { PrismaSequenceRunRepository } from "./prisma-sequence-run.repository";

const SYNCED_AT = new Date("2026-04-21T12:00:00Z");

describe("PrismaInvoiceRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaInvoiceRepository;

  let accountId: string;
  let businessId: string;
  let tierId: string;
  let customerId: string;
  let customerExternalId: string;
  let sequenceId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaInvoiceRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
        {
          provide: SEQUENCE_RUN_REPOSITORY,
          useClass: PrismaSequenceRunRepository,
        },
      ],
    }).compile();
    repo = module.get(PrismaInvoiceRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Test",
        email: `t-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    accountId = account.id;

    const business = await prisma.business.create({
      data: {
        accountId,
        name: "Biz",
        accountingProvider: "quickbooks",
        senderName: "Sender",
        senderEmail: "s@example.com",
        timezone: "UTC",
      },
    });
    businessId = business.id;

    const tier = await prisma.relationshipTier.create({
      data: {
        businessId,
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    });
    tierId = tier.id;

    customerExternalId = `cust-${randomUUID()}`;
    const customer = await prisma.customer.create({
      data: {
        businessId,
        externalId: customerExternalId,
        provider: "quickbooks",
        companyName: "Acme",
        relationshipTierId: tierId,
        totalOutstanding: 0,
      },
    });
    customerId = customer.id;

    const sequence = await prisma.sequence.create({
      data: {
        businessId,
        relationshipTierId: tierId,
        name: "Default Sequence",
      },
    });
    sequenceId = sequence.id;
  });

  afterEach(async () => {
    await prisma.sequenceRun.deleteMany({ where: { sequenceId } });
    await prisma.sequence.deleteMany({ where: { businessId } });
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.relationshipTier.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const seedInvoice = async (over: {
    externalId?: string;
    status?: InvoiceStatus;
    amountCents?: number;
    amountPaidCents?: number;
    balanceDueCents?: number;
    paidAt?: Date | null;
  } = {}): Promise<{ id: string; externalId: string }> => {
    const externalId = over.externalId ?? `inv-${randomUUID()}`;
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        customerId,
        externalId,
        provider: "quickbooks",
        invoiceNumber: "1001",
        amountCents: over.amountCents ?? 10_000,
        amountPaidCents: over.amountPaidCents ?? 0,
        balanceDueCents: over.balanceDueCents ?? 10_000,
        currency: "USD",
        dueDate: new Date("2026-05-01"),
        issuedDate: new Date("2026-04-01"),
        status: over.status ?? "open",
        paidAt: over.paidAt ?? null,
        paymentLinkUrl: null,
      },
      select: { id: true, externalId: true },
    });
    return invoice;
  };

  const seedRun = async (
    invoiceId: string,
    status: SequenceRunStatus,
  ): Promise<string> => {
    const run = await prisma.sequenceRun.create({
      data: {
        invoiceId,
        sequenceId,
        status,
        startedAt: new Date("2026-01-01T00:00:00Z"),
      },
      select: { id: true },
    });
    return run.id;
  };

  const setCustomerOutstanding = async (amount: number): Promise<void> => {
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalOutstanding: amount },
    });
  };

  const getCustomerOutstanding = async (): Promise<number> => {
    const c = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { totalOutstanding: true },
    });
    return c.totalOutstanding;
  };

  const mkCanonicalInvoice = (over: Partial<CanonicalInvoice>): CanonicalInvoice => ({
    externalId: over.externalId ?? `inv-${randomUUID()}`,
    invoiceNumber: over.invoiceNumber ?? "1001",
    customerExternalId: over.customerExternalId ?? customerExternalId,
    amountCents: over.amountCents ?? 10_000,
    amountPaidCents: over.amountPaidCents ?? 0,
    balanceDueCents: over.balanceDueCents ?? 10_000,
    currency: over.currency ?? "USD",
    paymentLinkUrl: over.paymentLinkUrl ?? null,
    issuedDate: over.issuedDate ?? new Date("2026-04-01"),
    dueDate: over.dueDate ?? new Date("2026-05-01"),
    lifecycle: over.lifecycle ?? "active",
    lastUpdatedAt: over.lastUpdatedAt ?? SYNCED_AT,
  });

  const mkChange = (over: {
    invoice: CanonicalInvoice;
    newStatus: InvoiceStatus;
    transition: InvoiceTransition;
    customerExternalId?: string;
  }): InvoiceChange => ({
    externalId: over.invoice.externalId,
    customerExternalId: over.customerExternalId ?? over.invoice.customerExternalId,
    invoice: over.invoice,
    newStatus: over.newStatus,
    transition: over.transition,
    provider: "quickbooks",
    lastSyncedAt: SYNCED_AT,
  });

  // ---------------------------------------------------------------------------
  // findPriorStatesByExternalIds
  // ---------------------------------------------------------------------------
  describe("findPriorStatesByExternalIds", () => {
    it("returns an empty map for empty input", async () => {
      const result = await repo.findPriorStatesByExternalIds(businessId, []);
      expect(result.size).toBe(0);
    });

    it("returns map for known invoices and omits unknown ones", async () => {
      const a = await seedInvoice({
        status: "open",
        balanceDueCents: 10_000,
      });
      const b = await seedInvoice({
        status: "partial",
        amountCents: 8_000,
        amountPaidCents: 3_000,
        balanceDueCents: 5_000,
      });

      const result = await repo.findPriorStatesByExternalIds(businessId, [
        a.externalId,
        b.externalId,
        "does-not-exist",
      ]);

      expect(result.size).toBe(2);
      expect(result.get(a.externalId)).toEqual({
        status: "open",
        balanceDueCents: 10_000,
      });
      expect(result.get(b.externalId)).toEqual({
        status: "partial",
        balanceDueCents: 5_000,
      });
      expect(result.get("does-not-exist")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // findLocalSnapshotForVoid
  // ---------------------------------------------------------------------------
  describe("findLocalSnapshotForVoid", () => {
    it("returns null when the invoice is not persisted", async () => {
      const result = await repo.findLocalSnapshotForVoid(
        businessId,
        "missing-external",
      );
      expect(result).toBeNull();
    });

    it("returns the snapshot with all 8 fields populated", async () => {
      const externalId = `inv-${randomUUID()}`;
      await prisma.invoice.create({
        data: {
          businessId,
          customerId,
          externalId,
          provider: "quickbooks",
          invoiceNumber: "INV-42",
          amountCents: 8_400,
          amountPaidCents: 1_400,
          balanceDueCents: 7_000,
          currency: "USD",
          dueDate: new Date("2026-06-15"),
          issuedDate: new Date("2026-05-15"),
          status: "partial",
          paymentLinkUrl: "https://pay.example/abc",
        },
      });

      const snap = await repo.findLocalSnapshotForVoid(businessId, externalId);

      expect(snap).not.toBeNull();
      expect(snap).toEqual({
        invoiceNumber: "INV-42",
        customerExternalId,
        amountCents: 8_400,
        amountPaidCents: 1_400,
        currency: "USD",
        paymentLinkUrl: "https://pay.example/abc",
        issuedDate: new Date("2026-05-15"),
        dueDate: new Date("2026-06-15"),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // applyChange — one test per transition kind
  // ---------------------------------------------------------------------------
  describe("applyChange", () => {
    it("no_change: bumps lastSyncedAt only and leaves balance/runs untouched", async () => {
      const seeded = await seedInvoice({
        status: "open",
        balanceDueCents: 10_000,
      });
      const completedRunId = await seedRun(
        seeded.id,
        SEQUENCE_RUN_STATUSES.COMPLETED,
      );
      await setCustomerOutstanding(10_000);

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId: seeded.externalId,
          balanceDueCents: 10_000,
        }),
        newStatus: "open",
        transition: { kind: "no_change" },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.invoiceId).toBe(seeded.id);
      expect(result.stoppedSequenceRunIds).toEqual([]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(row.status).toBe("open");
      expect(row.balanceDueCents).toBe(10_000);
      expect(row.lastSyncedAt?.toISOString()).toBe(SYNCED_AT.toISOString());

      expect(await getCustomerOutstanding()).toBe(10_000);
      const runRow = await prisma.sequenceRun.findUniqueOrThrow({
        where: { id: completedRunId },
      });
      expect(runRow.status).toBe(SEQUENCE_RUN_STATUSES.COMPLETED);
      expect(runRow.stoppedReason).toBeNull();
    });

    it("new_invoice (open, balance 8400): inserts row and increments customer outstanding", async () => {
      const externalId = `inv-${randomUUID()}`;

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId,
          amountCents: 8_400,
          amountPaidCents: 0,
          balanceDueCents: 8_400,
        }),
        newStatus: "open",
        transition: { kind: "new_invoice" },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.stoppedSequenceRunIds).toEqual([]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: result.invoiceId },
      });
      expect(row.externalId).toBe(externalId);
      expect(row.balanceDueCents).toBe(8_400);
      expect(row.status).toBe("open");
      expect(row.paidAt).toBeNull();
      expect(row.lastSyncedAt?.toISOString()).toBe(SYNCED_AT.toISOString());

      expect(await getCustomerOutstanding()).toBe(8_400);
    });

    it("balance_changed (5000 → 7000): adjusts customer outstanding by +2000", async () => {
      const seeded = await seedInvoice({
        status: "open",
        amountCents: 10_000,
        amountPaidCents: 5_000,
        balanceDueCents: 5_000,
      });
      await setCustomerOutstanding(5_000);

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId: seeded.externalId,
          amountCents: 10_000,
          amountPaidCents: 3_000,
          balanceDueCents: 7_000,
        }),
        newStatus: "open",
        transition: {
          kind: "balance_changed",
          priorBalance: 5_000,
          newBalance: 7_000,
        },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.invoiceId).toBe(seeded.id);
      expect(result.stoppedSequenceRunIds).toEqual([]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(row.balanceDueCents).toBe(7_000);
      expect(row.amountPaidCents).toBe(3_000);
      expect(row.status).toBe("open");

      expect(await getCustomerOutstanding()).toBe(7_000);
    });

    it("partial_payment (10000 → 4000): adjusts customer outstanding by -6000", async () => {
      const seeded = await seedInvoice({
        status: "open",
        amountCents: 10_000,
        amountPaidCents: 0,
        balanceDueCents: 10_000,
      });
      await setCustomerOutstanding(10_000);

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId: seeded.externalId,
          amountCents: 10_000,
          amountPaidCents: 6_000,
          balanceDueCents: 4_000,
        }),
        newStatus: "partial",
        transition: {
          kind: "partial_payment",
          priorBalance: 10_000,
          newBalance: 4_000,
        },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.invoiceId).toBe(seeded.id);
      expect(result.stoppedSequenceRunIds).toEqual([]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(row.balanceDueCents).toBe(4_000);
      expect(row.amountPaidCents).toBe(6_000);
      expect(row.status).toBe("partial");
      expect(row.paidAt).toBeNull();

      expect(await getCustomerOutstanding()).toBe(4_000);
    });

    it("fully_paid (10000 → 0): stamps paid_at, decrements customer, stops active run with payment_received", async () => {
      const seeded = await seedInvoice({
        status: "open",
        amountCents: 10_000,
        amountPaidCents: 0,
        balanceDueCents: 10_000,
      });
      const activeRunId = await seedRun(
        seeded.id,
        SEQUENCE_RUN_STATUSES.ACTIVE,
      );
      await setCustomerOutstanding(10_000);

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId: seeded.externalId,
          amountCents: 10_000,
          amountPaidCents: 10_000,
          balanceDueCents: 0,
        }),
        newStatus: "paid",
        transition: { kind: "fully_paid", priorBalance: 10_000 },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.invoiceId).toBe(seeded.id);
      expect(result.stoppedSequenceRunIds).toEqual([activeRunId]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(row.status).toBe("paid");
      expect(row.balanceDueCents).toBe(0);
      expect(row.amountPaidCents).toBe(10_000);
      expect(row.paidAt?.toISOString()).toBe(SYNCED_AT.toISOString());

      expect(await getCustomerOutstanding()).toBe(0);

      const runRow = await prisma.sequenceRun.findUniqueOrThrow({
        where: { id: activeRunId },
      });
      expect(runRow.status).toBe(SEQUENCE_RUN_STATUSES.STOPPED);
      expect(runRow.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
      expect(runRow.completedAt?.toISOString()).toBe(SYNCED_AT.toISOString());
    });

    it("voided (open, balance 8400): keeps paid_at, decrements customer, stops active run with invoice_voided", async () => {
      const seeded = await seedInvoice({
        status: "open",
        amountCents: 8_400,
        amountPaidCents: 0,
        balanceDueCents: 8_400,
        paidAt: null,
      });
      const activeRunId = await seedRun(
        seeded.id,
        SEQUENCE_RUN_STATUSES.ACTIVE,
      );
      await setCustomerOutstanding(8_400);

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId: seeded.externalId,
          amountCents: 8_400,
          amountPaidCents: 0,
          balanceDueCents: 8_400,
          lifecycle: "voided",
        }),
        newStatus: "voided",
        transition: {
          kind: "voided",
          priorBalance: 8_400,
          priorStatus: "open",
        },
      });

      const result = await repo.applyChange(businessId, change);

      expect(result.invoiceId).toBe(seeded.id);
      expect(result.stoppedSequenceRunIds).toEqual([activeRunId]);

      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: seeded.id },
      });
      expect(row.status).toBe("voided");
      // paid_at must NOT be overwritten on a void.
      expect(row.paidAt).toBeNull();

      expect(await getCustomerOutstanding()).toBe(0);

      const runRow = await prisma.sequenceRun.findUniqueOrThrow({
        where: { id: activeRunId },
      });
      expect(runRow.status).toBe(SEQUENCE_RUN_STATUSES.STOPPED);
      expect(runRow.stoppedReason).toBe(STOPPED_REASONS.INVOICE_VOIDED);
      expect(runRow.completedAt?.toISOString()).toBe(SYNCED_AT.toISOString());
    });

    // -------------------------------------------------------------------------
    // Atomicity
    // -------------------------------------------------------------------------
    it("rolls back the whole transaction when the customer is missing", async () => {
      const externalId = `inv-${randomUUID()}`;
      const before = await getCustomerOutstanding();
      const sequenceRunsBefore = await prisma.sequenceRun.count();

      const change = mkChange({
        invoice: mkCanonicalInvoice({
          externalId,
          customerExternalId: "ghost-customer",
          balanceDueCents: 5_000,
        }),
        newStatus: "open",
        transition: { kind: "new_invoice" },
        customerExternalId: "ghost-customer",
      });

      await expect(repo.applyChange(businessId, change)).rejects.toThrow(
        /not persisted/,
      );

      // The invoice must NOT have been inserted.
      const invoiceRow = await prisma.invoice.findFirst({
        where: { businessId, externalId },
      });
      expect(invoiceRow).toBeNull();

      // The seeded customer's totalOutstanding must NOT have changed.
      expect(await getCustomerOutstanding()).toBe(before);

      // No new sequence runs were created (sanity).
      const sequenceRunsAfter = await prisma.sequenceRun.count();
      expect(sequenceRunsAfter).toBe(sequenceRunsBefore);
    });
  });
});
