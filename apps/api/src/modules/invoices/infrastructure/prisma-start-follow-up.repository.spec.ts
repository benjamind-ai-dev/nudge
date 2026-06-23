import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { SEQUENCE_RUN_STATUSES } from "@nudge/shared";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaStartFollowUpRepository } from "./prisma-start-follow-up.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  businessId: string;
  accountId: string;
  customerId: string;
  invoiceId: string;
  sequenceId: string;
  stepId: string;
}

async function seedMinimalFixture(
  prisma: PrismaClient,
  invoiceStatus: string = "overdue",
): Promise<SeedResult> {
  const account = await prisma.account.create({
    data: {
      name: "Test Account",
      email: `test-${randomUUID()}@example.com`,
      plan: "starter",
      status: "active",
      maxBusinesses: 1,
    },
  });

  const business = await prisma.business.create({
    data: {
      accountId: account.id,
      name: "Test Business",
      senderName: "Sender",
      senderEmail: `sender-${randomUUID()}@example.com`,
      timezone: "America/New_York",
      accountingProvider: "quickbooks",
    },
  });

  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      externalId: randomUUID(),
      provider: "qbo",
      companyName: "Acme Corp",
    },
  });

  const sequence = await prisma.sequence.create({
    data: {
      businessId: business.id,
      name: "Default Sequence",
      isActive: true,
    },
  });

  const step = await prisma.sequenceStep.create({
    data: {
      sequenceId: sequence.id,
      stepOrder: 1,
      delayDays: 3,
      channel: "email",
      bodyTemplate: "Hello {{customer.company_name}}",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      externalId: randomUUID(),
      provider: "qbo",
      invoiceNumber: "INV-001",
      amountCents: 10_000,
      balanceDueCents: 10_000,
      dueDate: new Date("2026-05-01"),
      status: invoiceStatus,
    },
  });

  return {
    businessId: business.id,
    accountId: account.id,
    customerId: customer.id,
    invoiceId: invoice.id,
    sequenceId: sequence.id,
    stepId: step.id,
  };
}

// Scope every delete to the seeded account so this spec can run in parallel
// (CI uses multiple Jest workers against one shared test DB) without wiping
// rows seeded by sibling integration specs. Order respects the
// SequenceRun -> Sequence Restrict FK: runs are deleted before sequences.
async function cleanUp(prisma: PrismaClient, accountId: string): Promise<void> {
  await prisma.sequenceRun.deleteMany({
    where: { invoice: { business: { accountId } } },
  });
  await prisma.message.deleteMany({ where: { business: { accountId } } });
  await prisma.invoice.deleteMany({ where: { business: { accountId } } });
  await prisma.sequenceStep.deleteMany({
    where: { sequence: { business: { accountId } } },
  });
  await prisma.sequence.deleteMany({ where: { business: { accountId } } });
  await prisma.customer.deleteMany({ where: { business: { accountId } } });
  await prisma.relationshipTier.deleteMany({ where: { business: { accountId } } });
  await prisma.business.deleteMany({ where: { accountId } });
  await prisma.account.deleteMany({ where: { id: accountId } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrismaStartFollowUpRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaStartFollowUpRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaStartFollowUpRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();

    repo = moduleRef.get(PrismaStartFollowUpRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  describe("getFollowUpContext", () => {
    let seed: SeedResult;

    beforeEach(async () => {
      seed = await seedMinimalFixture(prisma, "overdue");
    });

    afterEach(async () => {
      await cleanUp(prisma, seed.accountId);
    });

    it("returns the mapped context for an invoice in the business", async () => {
      const ctx = await repo.getFollowUpContext(seed.invoiceId, seed.businessId);

      expect(ctx).not.toBeNull();
      expect(ctx!.status).toBe("overdue");
      expect(ctx!.dueDate).toEqual(new Date("2026-05-01"));
      expect(ctx!.businessTimezone).toBe("America/New_York");
      expect(ctx!.customerId).toBe(seed.customerId);
      // no customer-level sequence override seeded
      expect(ctx!.customerSequenceId).toBeNull();
      expect(ctx!.customerSequenceIsActive).toBeNull();
      // no tier seeded
      expect(ctx!.customerTierSequenceId).toBeNull();
      expect(ctx!.customerTierSequenceIsActive).toBeNull();
    });

    it("returns null for an invoice that belongs to a different business (tenant scoping)", async () => {
      const otherSeed = await seedMinimalFixture(prisma, "overdue");

      // look up otherSeed invoice using seed's businessId → must be null
      const ctx = await repo.getFollowUpContext(otherSeed.invoiceId, seed.businessId);
      expect(ctx).toBeNull();

      await cleanUp(prisma, otherSeed.accountId);
    });

    it("returns customer-level sequence override fields when present", async () => {
      const overrideSeq = await prisma.sequence.create({
        data: {
          businessId: seed.businessId,
          name: "Customer Override Sequence",
          isActive: true,
        },
      });
      await prisma.customer.update({
        where: { id: seed.customerId },
        data: { sequenceId: overrideSeq.id },
      });

      const ctx = await repo.getFollowUpContext(seed.invoiceId, seed.businessId);
      expect(ctx!.customerSequenceId).toBe(overrideSeq.id);
      expect(ctx!.customerSequenceIsActive).toBe(true);
    });

    it("returns tier sequence fields when the customer has a relationship tier with an active sequence", async () => {
      const tierSeq = await prisma.sequence.create({
        data: {
          businessId: seed.businessId,
          name: "Tier Sequence",
          isActive: true,
        },
      });
      const tier = await prisma.relationshipTier.create({
        data: {
          businessId: seed.businessId,
          name: "Platinum",
          sortOrder: 1,
          sequenceId: tierSeq.id,
        },
      });
      await prisma.customer.update({
        where: { id: seed.customerId },
        data: { relationshipTierId: tier.id },
      });

      const ctx = await repo.getFollowUpContext(seed.invoiceId, seed.businessId);
      expect(ctx!.customerTierSequenceId).toBe(tierSeq.id);
      expect(ctx!.customerTierSequenceIsActive).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("findDefaultTierSequenceId", () => {
    let seed: SeedResult;

    beforeEach(async () => {
      seed = await seedMinimalFixture(prisma);
    });

    afterEach(async () => {
      await cleanUp(prisma, seed.accountId);
    });

    it("returns the sequenceId of the default tier when it has an active sequence", async () => {
      const tierSeq = await prisma.sequence.create({
        data: {
          businessId: seed.businessId,
          name: "Default Tier Sequence",
          isActive: true,
        },
      });
      await prisma.relationshipTier.create({
        data: {
          businessId: seed.businessId,
          name: "Standard",
          sortOrder: 1,
          isDefault: true,
          sequenceId: tierSeq.id,
        },
      });

      const result = await repo.findDefaultTierSequenceId(seed.businessId);
      expect(result).toBe(tierSeq.id);
    });

    it("returns null when the default tier's sequence is inactive", async () => {
      const inactiveSeq = await prisma.sequence.create({
        data: {
          businessId: seed.businessId,
          name: "Inactive Sequence",
          isActive: false,
        },
      });
      await prisma.relationshipTier.create({
        data: {
          businessId: seed.businessId,
          name: "Standard",
          sortOrder: 1,
          isDefault: true,
          sequenceId: inactiveSeq.id,
        },
      });

      const result = await repo.findDefaultTierSequenceId(seed.businessId);
      expect(result).toBeNull();
    });

    it("returns null when no default tier exists", async () => {
      const result = await repo.findDefaultTierSequenceId(seed.businessId);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("findSequenceFirstStep", () => {
    let seed: SeedResult;

    beforeEach(async () => {
      seed = await seedMinimalFixture(prisma);
    });

    afterEach(async () => {
      await cleanUp(prisma, seed.accountId);
    });

    it("returns the step with the lowest stepOrder", async () => {
      // seed already has a step at stepOrder=1; add one at stepOrder=2
      await prisma.sequenceStep.create({
        data: {
          sequenceId: seed.sequenceId,
          stepOrder: 2,
          delayDays: 7,
          channel: "email",
          bodyTemplate: "Follow up 2",
        },
      });

      const result = await repo.findSequenceFirstStep(seed.sequenceId);
      expect(result).not.toBeNull();
      expect(result!.firstStepId).toBe(seed.stepId);
      expect(result!.firstStepDelayDays).toBe(3);
    });

    it("returns null when the sequence has no steps", async () => {
      const emptySeq = await prisma.sequence.create({
        data: {
          businessId: seed.businessId,
          name: "Empty Sequence",
          isActive: true,
        },
      });

      const result = await repo.findSequenceFirstStep(emptySeq.id);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("createSequenceRun", () => {
    let seed: SeedResult;

    beforeEach(async () => {
      seed = await seedMinimalFixture(prisma, "overdue");
    });

    afterEach(async () => {
      await cleanUp(prisma, seed.accountId);
    });

    const makeRunData = (
      seed: SeedResult,
      overrides: Partial<{ status: "active" }> = {},
    ) => ({
      invoiceId: seed.invoiceId,
      businessId: seed.businessId,
      sequenceId: seed.sequenceId,
      currentStepId: seed.stepId,
      status: "active" as const,
      nextSendAt: new Date("2026-06-01T10:00:00Z"),
      startedAt: new Date("2026-05-25T10:00:00Z"),
      firstStepSubject: null,
      firstStepBody: null,
      firstStepIncludePaymentLink: null,
      firstStepSkip: null,
      ...overrides,
    });

    it("creates a run and returns created:true on first call", async () => {
      const result = await repo.createSequenceRun(makeRunData(seed));

      expect(result.created).toBe(true);
      expect(result.runId).not.toBeNull();

      const run = await prisma.sequenceRun.findUnique({ where: { id: result.runId! } });
      expect(run).not.toBeNull();
      expect(run!.invoiceId).toBe(seed.invoiceId);
      expect(run!.status).toBe(SEQUENCE_RUN_STATUSES.ACTIVE);
    });

    it("returns created:false on a second call for the same invoice (dedup against active run)", async () => {
      await repo.createSequenceRun(makeRunData(seed));
      const second = await repo.createSequenceRun(makeRunData(seed));

      expect(second.created).toBe(false);
      expect(second.runId).toBeNull();

      const runs = await prisma.sequenceRun.findMany({ where: { invoiceId: seed.invoiceId } });
      expect(runs).toHaveLength(1);
    });

    it("returns created:false/null when the invoice is in a paid status (not chaseable)", async () => {
      await prisma.invoice.update({
        where: { id: seed.invoiceId },
        data: { status: "paid" },
      });

      const result = await repo.createSequenceRun(makeRunData(seed));

      expect(result.created).toBe(false);
      expect(result.runId).toBeNull();

      const runs = await prisma.sequenceRun.findMany({ where: { invoiceId: seed.invoiceId } });
      expect(runs).toHaveLength(0);
    });

    it("returns created:false/null when the invoice is voided (not chaseable)", async () => {
      await prisma.invoice.update({
        where: { id: seed.invoiceId },
        data: { status: "voided" },
      });

      const result = await repo.createSequenceRun(makeRunData(seed));

      expect(result.created).toBe(false);
      expect(result.runId).toBeNull();
    });

    it("returns created:false when existing run is paused (dedup against paused run)", async () => {
      // Create a paused run manually
      await prisma.sequenceRun.create({
        data: {
          invoiceId: seed.invoiceId,
          sequenceId: seed.sequenceId,
          currentStepId: seed.stepId,
          status: SEQUENCE_RUN_STATUSES.PAUSED,
          nextSendAt: new Date("2026-06-01T10:00:00Z"),
          startedAt: new Date("2026-05-25T10:00:00Z"),
        },
      });

      const result = await repo.createSequenceRun(makeRunData(seed));

      expect(result.created).toBe(false);
      expect(result.runId).toBeNull();
    });

    it("creates a new run when prior run is stopped (completed runs do not block)", async () => {
      // Create a stopped run — should not block a new one
      await prisma.sequenceRun.create({
        data: {
          invoiceId: seed.invoiceId,
          sequenceId: seed.sequenceId,
          currentStepId: seed.stepId,
          status: SEQUENCE_RUN_STATUSES.STOPPED,
          nextSendAt: new Date("2026-06-01T10:00:00Z"),
          startedAt: new Date("2026-05-25T10:00:00Z"),
        },
      });

      const result = await repo.createSequenceRun(makeRunData(seed));

      expect(result.created).toBe(true);
      expect(result.runId).not.toBeNull();
    });
  });
});
