import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import {
  SEQUENCE_RUN_STATUSES,
  STOPPED_REASONS,
  type SequenceRunStatus,
} from "@nudge/shared";
import { randomUUID } from "crypto";
import { PrismaSequenceRunRepository } from "./prisma-sequence-run.repository";

describe("PrismaSequenceRunRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaSequenceRunRepository;

  let accountId: string;
  let businessId: string;
  let tierId: string;
  let customerId: string;
  let sequenceId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [PrismaSequenceRunRepository],
    }).compile();
    repo = module.get(PrismaSequenceRunRepository);
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

    const customer = await prisma.customer.create({
      data: {
        businessId,
        externalId: `cust-${randomUUID()}`,
        provider: "quickbooks",
        companyName: "Acme",
        relationshipTierId: tierId,
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

  const seedInvoice = async (): Promise<string> => {
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        customerId,
        externalId: `inv-${randomUUID()}`,
        provider: "quickbooks",
        amountCents: 10_000,
        amountPaidCents: 0,
        balanceDueCents: 10_000,
        currency: "USD",
        dueDate: new Date("2026-01-01"),
        status: "open",
      },
      select: { id: true },
    });
    return invoice.id;
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

  it("returns [] and performs no update when there are no active or paused runs", async () => {
    const invoiceId = await seedInvoice();
    const completedId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.COMPLETED);
    const stoppedId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.STOPPED);

    const completedAt = new Date("2026-02-01T12:00:00Z");
    const result = await prisma.$transaction((tx) =>
      repo.stopActiveRunsForInvoice(
        tx,
        invoiceId,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      ),
    );

    expect(result).toEqual([]);

    const completedRow = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: completedId },
    });
    const stoppedRow = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: stoppedId },
    });
    expect(completedRow.status).toBe("completed");
    expect(completedRow.stoppedReason).toBeNull();
    expect(completedRow.completedAt).toBeNull();
    expect(stoppedRow.status).toBe("stopped");
    expect(stoppedRow.stoppedReason).toBeNull();
  });

  it("stops the active run and leaves completed runs unchanged", async () => {
    const invoiceId = await seedInvoice();
    const activeId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.ACTIVE);
    const completedId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.COMPLETED);

    const completedAt = new Date("2026-02-01T12:00:00Z");
    const result = await prisma.$transaction((tx) =>
      repo.stopActiveRunsForInvoice(
        tx,
        invoiceId,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      ),
    );

    expect(result).toEqual([activeId]);

    const active = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: activeId },
    });
    const completed = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: completedId },
    });

    expect(active.status).toBe("stopped");
    expect(active.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
    expect(active.completedAt?.toISOString()).toBe(completedAt.toISOString());

    expect(completed.status).toBe("completed");
    expect(completed.stoppedReason).toBeNull();
    expect(completed.completedAt).toBeNull();
  });

  it("stops paused runs", async () => {
    const invoiceId = await seedInvoice();
    const pausedId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.PAUSED);

    const completedAt = new Date("2026-02-02T08:00:00Z");
    const result = await prisma.$transaction((tx) =>
      repo.stopActiveRunsForInvoice(
        tx,
        invoiceId,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      ),
    );

    expect(result).toEqual([pausedId]);
    const row = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: pausedId },
    });
    expect(row.status).toBe("stopped");
    expect(row.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
    expect(row.completedAt?.toISOString()).toBe(completedAt.toISOString());
  });

  // The DB has a partial unique index `idx_one_active_run_per_invoice` so an
  // invoice can have at most one active|paused run at a time. We exercise the
  // mixed-status query across two invoices: invoice A has an active run, B has
  // a paused run. Both calls flip status='stopped', proving the WHERE clause
  // matches both states and that other invoices are not affected.
  it("matches both active and paused statuses across invoices, isolated per invoice", async () => {
    const invoiceA = await seedInvoice();
    const invoiceB = await seedInvoice();
    const activeId = await seedRun(invoiceA, SEQUENCE_RUN_STATUSES.ACTIVE);
    const pausedId = await seedRun(invoiceB, SEQUENCE_RUN_STATUSES.PAUSED);

    const completedAt = new Date("2026-02-03T09:30:00Z");

    const stoppedFromA = await prisma.$transaction((tx) =>
      repo.stopActiveRunsForInvoice(
        tx,
        invoiceA,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      ),
    );
    expect(stoppedFromA).toEqual([activeId]);

    const pausedRowMidway = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: pausedId },
    });
    expect(pausedRowMidway.status).toBe("paused");

    const stoppedFromB = await prisma.$transaction((tx) =>
      repo.stopActiveRunsForInvoice(
        tx,
        invoiceB,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      ),
    );
    expect(stoppedFromB).toEqual([pausedId]);

    const aRow = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: activeId },
    });
    const bRow = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: pausedId },
    });
    expect(aRow.status).toBe("stopped");
    expect(bRow.status).toBe("stopped");
    expect(aRow.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
    expect(bRow.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
  });

  it("honors the caller-provided transaction client", async () => {
    const invoiceId = await seedInvoice();
    const activeId = await seedRun(invoiceId, SEQUENCE_RUN_STATUSES.ACTIVE);

    const completedAt = new Date("2026-02-04T10:00:00Z");
    const ids = await prisma.$transaction(async (tx) => {
      return repo.stopActiveRunsForInvoice(
        tx,
        invoiceId,
        STOPPED_REASONS.PAYMENT_RECEIVED,
        completedAt,
      );
    });

    expect(ids).toEqual([activeId]);
    const row = await prisma.sequenceRun.findUniqueOrThrow({
      where: { id: activeId },
    });
    expect(row.status).toBe("stopped");
    expect(row.stoppedReason).toBe(STOPPED_REASONS.PAYMENT_RECEIVED);
    expect(row.completedAt?.toISOString()).toBe(completedAt.toISOString());
  });
});
