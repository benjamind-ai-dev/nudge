import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaSequenceTriggerRepository } from "./prisma-sequence-trigger.repository";

describe("PrismaSequenceTriggerRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaSequenceTriggerRepository;

  let accountId: string;
  let businessId: string;
  let tierId: string;
  let customerId: string;
  let sequenceId: string;
  let stepId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaSequenceTriggerRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaSequenceTriggerRepository);
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

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId,
        stepOrder: 1,
        delayDays: 0,
        channel: "email",
        subjectTemplate: "Hi",
        bodyTemplate: "Body",
      },
      select: { id: true },
    });
    stepId = step.id;
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

  describe("createSequenceRun", () => {
    const nextSendAt = new Date("2026-02-01T12:00:00Z");
    const startedAt = new Date("2026-01-15T09:00:00Z");

    it("returns created=false when the invoice was paid before the run could be created", async () => {
      const invoice = await prisma.invoice.create({
        data: {
          businessId,
          customerId,
          externalId: `inv-${randomUUID()}`,
          provider: "quickbooks",
          amountCents: 10_000,
          amountPaidCents: 10_000,
          balanceDueCents: 0,
          currency: "USD",
          dueDate: new Date("2026-01-01"),
          status: "paid",
        },
        select: { id: true },
      });

      const result = await repo.createSequenceRun({
        invoiceId: invoice.id,
        sequenceId,
        currentStepId: stepId,
        status: "active",
        nextSendAt,
        startedAt,
      });

      expect(result).toEqual({ created: false, runId: null });

      const count = await prisma.sequenceRun.count({
        where: { invoiceId: invoice.id },
      });
      expect(count).toBe(0);
    });

    it("returns created=false when the invoice was voided before the run could be created", async () => {
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
          status: "voided",
        },
        select: { id: true },
      });

      const result = await repo.createSequenceRun({
        invoiceId: invoice.id,
        sequenceId,
        currentStepId: stepId,
        status: "active",
        nextSendAt,
        startedAt,
      });

      expect(result).toEqual({ created: false, runId: null });

      const count = await prisma.sequenceRun.count({
        where: { invoiceId: invoice.id },
      });
      expect(count).toBe(0);
    });
  });
});
