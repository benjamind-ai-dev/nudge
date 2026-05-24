import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaAiDraftRepository } from "./prisma-ai-draft.repository";

describe("PrismaAiDraftRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaAiDraftRepository;

  let accountId: string;
  let businessId: string;
  let customerId: string;
  let sequenceId: string;
  let invoiceId: string;
  let sequenceRunId: string;
  let messageId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaAiDraftRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = moduleRef.get(PrismaAiDraftRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Acct",
        email: `ai-draft-${randomUUID()}@example.com`,
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
        senderName: "Sandra Owens",
        senderEmail: `sender-${randomUUID()}@example.com`,
        timezone: "UTC",
      },
    });
    businessId = business.id;

    const customer = await prisma.customer.create({
      data: {
        businessId,
        externalId: randomUUID(),
        provider: "qbo",
        companyName: "Midwest Plastics",
        contactName: "John Miller",
        contactEmail: "john@midwest.example.com",
      },
    });
    customerId = customer.id;

    const sequence = await prisma.sequence.create({
      data: { businessId, name: "Default" },
    });
    sequenceId = sequence.id;

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        customerId,
        externalId: randomUUID(),
        provider: "qbo",
        invoiceNumber: "INV-1042",
        amountCents: 250000,
        balanceDueCents: 250000,
        currency: "USD",
        dueDate: new Date("2026-04-15T00:00:00Z"),
        status: "open",
        daysOverdue: 39,
      },
    });
    invoiceId = invoice.id;

    const run = await prisma.sequenceRun.create({
      data: {
        invoiceId,
        sequenceId,
        status: "active",
        startedAt: new Date(),
      },
    });
    sequenceRunId = run.id;

    const message = await prisma.message.create({
      data: {
        sequenceRunId,
        invoiceId,
        customerId,
        businessId,
        channel: "email",
        body: "Hi John Miller, INV-1042 is overdue.",
        status: "sent",
        replyBody: "We dispute this charge.",
        repliedAt: new Date(),
      },
    });
    messageId = message.id;
  });

  afterEach(async () => {
    await prisma.message.deleteMany({ where: { businessId } });
    await prisma.sequenceRun.deleteMany({ where: { sequenceId } });
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.sequence.deleteMany({ where: { businessId } });
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  describe("findMessageContext", () => {
    it("returns the joined message + invoice + customer + business", async () => {
      const ctx = await repo.findMessageContext(messageId, businessId);
      expect(ctx).not.toBeNull();
      expect(ctx!.message.id).toBe(messageId);
      expect(ctx!.message.replyBody).toBe("We dispute this charge.");
      expect(ctx!.invoice.invoiceNumber).toBe("INV-1042");
      expect(ctx!.invoice.balanceDueCents).toBe(250000);
      expect(ctx!.invoice.currency).toBe("USD");
      expect(ctx!.invoice.daysOverdue).toBe(39);
      expect(ctx!.customer.companyName).toBe("Midwest Plastics");
      expect(ctx!.customer.contactName).toBe("John Miller");
      expect(ctx!.business.senderName).toBe("Sandra Owens");
    });

    it("returns null when called with a wrong businessId (tenant isolation)", async () => {
      const ctx = await repo.findMessageContext(messageId, randomUUID());
      expect(ctx).toBeNull();
    });

    it("returns null when the message id does not exist", async () => {
      const ctx = await repo.findMessageContext(randomUUID(), businessId);
      expect(ctx).toBeNull();
    });
  });

  describe("saveDraft", () => {
    it("writes the draft to ai_draft_response", async () => {
      await repo.saveDraft(messageId, businessId, "Thanks for your reply.");
      const row = await prisma.message.findUnique({ where: { id: messageId } });
      expect(row!.aiDraftResponse).toBe("Thanks for your reply.");
    });

    it("writes null", async () => {
      await repo.saveDraft(messageId, businessId, null);
      const row = await prisma.message.findUnique({ where: { id: messageId } });
      expect(row!.aiDraftResponse).toBeNull();
    });

    it("does not modify other businesses' messages (tenant isolation)", async () => {
      await repo.saveDraft(messageId, randomUUID(), "should not write");
      const row = await prisma.message.findUnique({ where: { id: messageId } });
      expect(row!.aiDraftResponse).toBeNull();
    });
  });
});
