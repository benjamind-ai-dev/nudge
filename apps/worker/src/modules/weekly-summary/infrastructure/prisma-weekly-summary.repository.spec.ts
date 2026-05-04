import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaWeeklySummaryRepository } from "./prisma-weekly-summary.repository";

describe("PrismaWeeklySummaryRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaWeeklySummaryRepository;

  let accountId: string;
  let businessId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaWeeklySummaryRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaWeeklySummaryRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const account = await prisma.account.create({
      data: {
        name: "Test",
        email: `ws-${randomUUID()}@example.com`,
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
  });

  afterEach(async () => {
    await prisma.weeklySummary.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  it("inserts a pending row and exists() reflects it", async () => {
    const summary = await repo.insertPending({
      businessId,
      weekStartsAt: "2026-05-04",
    });
    expect(summary.status).toBe("pending");
    expect(await repo.exists(businessId, "2026-05-04")).toBe(true);
    expect(await repo.exists(businessId, "2026-05-11")).toBe(false);
  });

  it("rejects duplicate (businessId, weekStartsAt)", async () => {
    await repo.insertPending({ businessId, weekStartsAt: "2026-05-04" });
    await expect(
      repo.insertPending({ businessId, weekStartsAt: "2026-05-04" }),
    ).rejects.toThrow();
  });

  it("save() persists status transitions and metadata", async () => {
    const pending = await repo.insertPending({
      businessId,
      weekStartsAt: "2026-05-04",
    });
    const sent = pending.markSent({
      aiParagraph: "Recovery up.",
      aiModel: "claude-sonnet-4-6",
      aiInputTokens: 100,
      aiOutputTokens: 30,
      metrics: { foo: 1 } as never,
      recipientEmails: ["a@b.com"],
      resendMessageIds: ["rs_1"],
      sentAt: new Date("2026-05-05T08:00:00Z"),
    });
    await repo.save(sent);

    const row = await prisma.weeklySummary.findFirstOrThrow({
      where: { businessId },
    });
    expect(row.status).toBe("sent");
    expect(row.aiParagraph).toBe("Recovery up.");
    expect(row.recipientEmails).toEqual(["a@b.com"]);
    expect(row.resendMessageIds).toEqual(["rs_1"]);
  });

  it("save() persists failure status with error message", async () => {
    const pending = await repo.insertPending({
      businessId,
      weekStartsAt: "2026-05-04",
    });
    const failed = pending.markFailed("no owner users");
    await repo.save(failed);

    const row = await prisma.weeklySummary.findFirstOrThrow({
      where: { businessId },
    });
    expect(row.status).toBe("failed");
    expect(row.errorMessage).toBe("no owner users");
  });
});
