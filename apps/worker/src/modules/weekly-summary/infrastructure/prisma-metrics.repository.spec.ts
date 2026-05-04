import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaMetricsRepository } from "./prisma-metrics.repository";

const WEEK_STARTS_AT = "2026-05-04";
const weekStart = new Date("2026-05-04T00:00:00Z");
const weekEnd = new Date("2026-05-11T00:00:00Z");
const priorWeekStart = new Date("2026-04-27T00:00:00Z");

describe("PrismaMetricsRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaMetricsRepository;

  let accountId: string;
  let businessId: string;
  let tierId: string;
  let sequenceId: string;
  let c1Id: string;
  let c2Id: string;
  let c3Id: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaMetricsRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaMetricsRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Test",
        email: `metrics-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    accountId = account.id;

    const business = await prisma.business.create({
      data: {
        accountId,
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Sender",
        senderEmail: "sender@example.com",
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

    const sequence = await prisma.sequence.create({
      data: {
        businessId,
        relationshipTierId: tierId,
        name: "Default Sequence",
      },
    });
    sequenceId = sequence.id;

    const [c1, c2, c3] = await Promise.all([
      prisma.customer.create({
        data: {
          businessId,
          externalId: `c1-${randomUUID()}`,
          provider: "quickbooks",
          companyName: "Alpha Inc",
          relationshipTierId: tierId,
          totalOutstanding: 250_000,
        },
      }),
      prisma.customer.create({
        data: {
          businessId,
          externalId: `c2-${randomUUID()}`,
          provider: "quickbooks",
          companyName: "Beta LLC",
          relationshipTierId: tierId,
          totalOutstanding: 180_000,
        },
      }),
      prisma.customer.create({
        data: {
          businessId,
          externalId: `c3-${randomUUID()}`,
          provider: "quickbooks",
          companyName: "Gamma Co",
          relationshipTierId: tierId,
          totalOutstanding: 100_000,
        },
      }),
    ]);
    c1Id = c1.id;
    c2Id = c2.id;
    c3Id = c3.id;
  });

  afterEach(async () => {
    await prisma.sequenceRun.deleteMany({ where: { sequenceId } });
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.sequence.deleteMany({ where: { businessId } });
    await prisma.relationshipTier.deleteMany({ where: { businessId } });
    await prisma.user.deleteMany({ where: { accountId } });
    await prisma.weeklySummary.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const seedInvoice = async (over: {
    customerId?: string;
    businessId?: string;
    amountCents?: number;
    status?: string;
    daysOverdue?: number;
    issuedDate?: Date | null;
    paidAt?: Date | null;
  } = {}): Promise<string> => {
    const inv = await prisma.invoice.create({
      data: {
        businessId: over.businessId ?? businessId,
        customerId: over.customerId ?? c1Id,
        externalId: `inv-${randomUUID()}`,
        provider: "quickbooks",
        invoiceNumber: `INV-${randomUUID()}`,
        amountCents: over.amountCents ?? 10_000,
        amountPaidCents: 0,
        balanceDueCents: over.amountCents ?? 10_000,
        currency: "USD",
        dueDate: new Date("2026-04-01"),
        issuedDate: over.issuedDate !== undefined ? over.issuedDate : new Date("2026-03-01"),
        status: over.status ?? "open",
        daysOverdue: over.daysOverdue ?? 0,
        paidAt: over.paidAt ?? null,
        paymentLinkUrl: null,
      },
      select: { id: true },
    });
    return inv.id;
  };

  const seedRun = async (over: {
    invoiceId: string;
    status: string;
    completedAt?: Date | null;
  }): Promise<string> => {
    const run = await prisma.sequenceRun.create({
      data: {
        invoiceId: over.invoiceId,
        sequenceId,
        status: over.status,
        startedAt: new Date("2026-04-01T00:00:00Z"),
        completedAt: over.completedAt ?? null,
      },
      select: { id: true },
    });
    return run.id;
  };

  // ---------------------------------------------------------------------------
  // loadBusiness
  // ---------------------------------------------------------------------------
  it("loadBusiness returns the read model", async () => {
    const result = await repo.loadBusiness(businessId);

    expect(result).toEqual(
      expect.objectContaining({
        id: businessId,
        accountId,
        name: "Acme Corp",
        timezone: "UTC",
        senderEmail: "sender@example.com",
        senderName: "Sender",
      }),
    );
  });

  it("loadBusiness returns null for unknown id", async () => {
    const result = await repo.loadBusiness(randomUUID());
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // loadOwnerRecipients
  // ---------------------------------------------------------------------------
  it("loadOwnerRecipients returns only role=owner users", async () => {
    const ownerEmail = `owner-${randomUUID()}@example.com`;
    const memberEmail = `member-${randomUUID()}@example.com`;

    await prisma.user.create({
      data: {
        accountId,
        email: ownerEmail,
        name: "Owner User",
        role: "owner",
      },
    });
    await prisma.user.create({
      data: {
        accountId,
        email: memberEmail,
        name: "Viewer User",
        role: "viewer",
      },
    });

    const recipients = await repo.loadOwnerRecipients(accountId);

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toEqual(
      expect.objectContaining({ email: ownerEmail }),
    );
  });

  it("loadOwnerRecipients returns empty array for an account with no owners", async () => {
    await prisma.user.create({
      data: {
        accountId,
        email: `viewer-${randomUUID()}@example.com`,
        name: "Viewer User",
        role: "viewer",
      },
    });

    const recipients = await repo.loadOwnerRecipients(accountId);
    expect(recipients).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // computeMetrics — recovered amounts
  // ---------------------------------------------------------------------------
  it("computeMetrics returns recovered amounts and prior-week comparison", async () => {
    // 2 invoices paid this week
    await seedInvoice({
      customerId: c1Id,
      amountCents: 50_000,
      status: "paid",
      paidAt: new Date("2026-05-05T10:00:00Z"),
      issuedDate: new Date("2026-04-20"),
    });
    await seedInvoice({
      customerId: c2Id,
      amountCents: 30_000,
      status: "paid",
      paidAt: new Date("2026-05-06T10:00:00Z"),
      issuedDate: new Date("2026-04-22"),
    });

    // 1 invoice paid prior week
    await seedInvoice({
      customerId: c3Id,
      amountCents: 20_000,
      status: "paid",
      paidAt: new Date("2026-04-29T10:00:00Z"),
    });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    expect(metrics).toEqual(
      expect.objectContaining({
        weekStartsAt: WEEK_STARTS_AT,
        recoveredThisWeekCents: 80_000,
        recoveredPriorWeekCents: 20_000,
        invoicesCollectedCount: 2,
      }),
    );
  });

  it("computeMetrics computes avgDaysToPayThisWeek correctly", async () => {
    // Invoice issued 10 days before week start, paid 5 days into the week = 15 days
    await seedInvoice({
      customerId: c1Id,
      amountCents: 10_000,
      status: "paid",
      issuedDate: new Date("2026-04-24T00:00:00Z"), // 10 days before weekStart
      paidAt: new Date("2026-05-09T00:00:00Z"),     // 5 days into the week = 15 total days
    });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    expect(metrics.avgDaysToPayThisWeek).toBe(15);
  });

  // ---------------------------------------------------------------------------
  // computeMetrics — top-3 overdue customers
  // ---------------------------------------------------------------------------
  it("computeMetrics returns top-3 overdue customers by totalOutstanding desc", async () => {
    // Seed overdue invoices for the top customers so they show in daysMap
    await seedInvoice({
      customerId: c1Id,
      amountCents: 250_000,
      status: "overdue",
      daysOverdue: 30,
    });
    await seedInvoice({
      customerId: c2Id,
      amountCents: 180_000,
      status: "overdue",
      daysOverdue: 20,
    });
    await seedInvoice({
      customerId: c3Id,
      amountCents: 100_000,
      status: "overdue",
      daysOverdue: 10,
    });

    // Tenant isolation: seed an overdue invoice for a different business — must NOT appear
    const otherAccount = await prisma.account.create({
      data: {
        name: "Other",
        email: `other-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    const otherBusiness = await prisma.business.create({
      data: {
        accountId: otherAccount.id,
        name: "Other Biz",
        accountingProvider: "quickbooks",
        senderName: "Other",
        senderEmail: "other@example.com",
        timezone: "UTC",
      },
    });
    const otherTier = await prisma.relationshipTier.create({
      data: {
        businessId: otherBusiness.id,
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        businessId: otherBusiness.id,
        externalId: `other-cust-${randomUUID()}`,
        provider: "quickbooks",
        companyName: "Intruder Corp",
        relationshipTierId: otherTier.id,
        totalOutstanding: 9_999_999,
      },
    });
    await prisma.invoice.create({
      data: {
        businessId: otherBusiness.id,
        customerId: otherCustomer.id,
        externalId: `inv-other-${randomUUID()}`,
        provider: "quickbooks",
        invoiceNumber: "X-001",
        amountCents: 9_999_999,
        amountPaidCents: 0,
        balanceDueCents: 9_999_999,
        currency: "USD",
        dueDate: new Date("2026-01-01"),
        status: "overdue",
        daysOverdue: 120,
        paidAt: null,
        paymentLinkUrl: null,
      },
    });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    expect(metrics.topOverdueCustomers).toHaveLength(3);
    expect(metrics.topOverdueCustomers[0]).toEqual(
      expect.objectContaining({
        customerId: c1Id,
        customerName: "Alpha Inc",
        totalOutstandingCents: 250_000,
        oldestInvoiceDaysOverdue: 30,
      }),
    );
    expect(metrics.topOverdueCustomers[1]).toEqual(
      expect.objectContaining({
        customerId: c2Id,
        totalOutstandingCents: 180_000,
      }),
    );
    expect(metrics.topOverdueCustomers[2]).toEqual(
      expect.objectContaining({
        customerId: c3Id,
        totalOutstandingCents: 100_000,
      }),
    );

    // Intruder should not appear
    const customerNames = metrics.topOverdueCustomers.map((c) => c.customerName);
    expect(customerNames).not.toContain("Intruder Corp");

    // Cleanup other business data
    await prisma.invoice.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.customer.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.relationshipTier.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.business.deleteMany({ where: { id: otherBusiness.id } });
    await prisma.account.deleteMany({ where: { id: otherAccount.id } });
  });

  // ---------------------------------------------------------------------------
  // computeMetrics — flagged runs
  // ---------------------------------------------------------------------------
  it("computeMetrics returns flagged runs (completed in window with no payment)", async () => {
    // Completed run within window, invoice unpaid → flagged
    const unpaidInvoiceId = await seedInvoice({
      customerId: c1Id,
      amountCents: 75_000,
      status: "overdue",
      paidAt: null,
    });
    const flaggedRunId = await seedRun({
      invoiceId: unpaidInvoiceId,
      status: "completed",
      completedAt: new Date("2026-05-06T12:00:00Z"),
    });

    // Completed run within window but invoice IS paid → not flagged
    const paidInvoiceId = await seedInvoice({
      customerId: c2Id,
      amountCents: 20_000,
      status: "paid",
      paidAt: new Date("2026-05-05T10:00:00Z"),
    });
    await seedRun({
      invoiceId: paidInvoiceId,
      status: "completed",
      completedAt: new Date("2026-05-05T08:00:00Z"),
    });

    // Completed run OUTSIDE the window → not flagged
    const anotherUnpaidId = await seedInvoice({
      customerId: c3Id,
      amountCents: 15_000,
      status: "overdue",
      paidAt: null,
    });
    await seedRun({
      invoiceId: anotherUnpaidId,
      status: "completed",
      completedAt: new Date("2026-05-01T10:00:00Z"), // before weekStart
    });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    expect(metrics.flaggedRuns).toHaveLength(1);
    expect(metrics.flaggedRuns[0]).toEqual(
      expect.objectContaining({
        runId: flaggedRunId,
        customerId: c1Id,
        customerName: "Alpha Inc",
        invoiceAmountCents: 75_000,
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // computeMetrics — active sequences count and top-5 overdue invoices
  // ---------------------------------------------------------------------------
  it("computeMetrics returns active sequences count and top-5 overdue invoices", async () => {
    // Seed 2 active sequence runs
    const inv1Id = await seedInvoice({
      customerId: c1Id,
      amountCents: 100_000,
      status: "overdue",
      daysOverdue: 50,
    });
    const inv2Id = await seedInvoice({
      customerId: c2Id,
      amountCents: 80_000,
      status: "overdue",
      daysOverdue: 40,
    });
    await seedRun({ invoiceId: inv1Id, status: "active" });
    await seedRun({ invoiceId: inv2Id, status: "active" });

    // 1 non-active run — should NOT count toward active sequences
    const inv3Id = await seedInvoice({
      customerId: c3Id,
      amountCents: 60_000,
      status: "overdue",
      daysOverdue: 30,
    });
    await seedRun({ invoiceId: inv3Id, status: "stopped" });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    expect(metrics.activeSequencesCount).toBe(2);

    // top-5 overdue invoices: ordered by daysOverdue desc then amountCents desc
    expect(metrics.top5OverdueInvoices).toHaveLength(3);
    expect(metrics.top5OverdueInvoices[0]).toEqual(
      expect.objectContaining({
        customerName: "Alpha Inc",
        amountCents: 100_000,
        daysOverdue: 50,
        currentSequenceStep: null,
      }),
    );
    expect(metrics.top5OverdueInvoices[1]).toEqual(
      expect.objectContaining({
        customerName: "Beta LLC",
        amountCents: 80_000,
        daysOverdue: 40,
      }),
    );
    expect(metrics.top5OverdueInvoices[2]).toEqual(
      expect.objectContaining({
        customerName: "Gamma Co",
        amountCents: 60_000,
        daysOverdue: 30,
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // computeMetrics — tenant isolation (overdue count)
  // ---------------------------------------------------------------------------
  it("computeMetrics does not include another business's overdue invoices", async () => {
    // Seed 1 overdue invoice for our business
    await seedInvoice({
      customerId: c1Id,
      status: "overdue",
      daysOverdue: 10,
    });

    // Seed overdue invoice for a different business
    const otherAccount = await prisma.account.create({
      data: {
        name: "Other",
        email: `isolation-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    const otherBusiness = await prisma.business.create({
      data: {
        accountId: otherAccount.id,
        name: "Other Biz",
        accountingProvider: "quickbooks",
        senderName: "Other",
        senderEmail: "other@example.com",
        timezone: "UTC",
      },
    });
    const otherTier = await prisma.relationshipTier.create({
      data: {
        businessId: otherBusiness.id,
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        businessId: otherBusiness.id,
        externalId: `cust-${randomUUID()}`,
        provider: "quickbooks",
        companyName: "Other Customer",
        relationshipTierId: otherTier.id,
        totalOutstanding: 0,
      },
    });
    await prisma.invoice.create({
      data: {
        businessId: otherBusiness.id,
        customerId: otherCustomer.id,
        externalId: `inv-${randomUUID()}`,
        provider: "quickbooks",
        invoiceNumber: "X-001",
        amountCents: 50_000,
        amountPaidCents: 0,
        balanceDueCents: 50_000,
        currency: "USD",
        dueDate: new Date("2026-01-01"),
        status: "overdue",
        daysOverdue: 99,
        paidAt: null,
        paymentLinkUrl: null,
      },
    });

    const metrics = await repo.computeMetrics({
      businessId,
      weekStartsAt: WEEK_STARTS_AT,
    });

    // Only our 1 overdue invoice should be counted
    expect(metrics.currentlyOverdueCount).toBe(1);

    // Cleanup
    await prisma.invoice.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.customer.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.relationshipTier.deleteMany({ where: { businessId: otherBusiness.id } });
    await prisma.business.deleteMany({ where: { id: otherBusiness.id } });
    await prisma.account.deleteMany({ where: { id: otherAccount.id } });
  });
});
