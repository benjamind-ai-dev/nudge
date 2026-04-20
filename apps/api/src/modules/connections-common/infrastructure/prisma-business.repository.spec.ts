import { Test } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaBusinessRepository } from "./prisma-business.repository";

describe("PrismaBusinessRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaBusinessRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaBusinessRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaBusinessRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns null for a missing business", async () => {
    expect(
      await repo.findById("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("returns { id } for an existing business", async () => {
    const account = await prisma.account.create({
      data: {
        name: "T",
        email: `t-${randomUUID()}@example.com`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    const business = await prisma.business.create({
      data: {
        accountId: account.id,
        name: "Biz",
        accountingProvider: "quickbooks",
        senderName: "S",
        senderEmail: "s@example.com",
        timezone: "UTC",
      },
    });

    const found = await repo.findById(business.id);
    expect(found).toEqual({ id: business.id });

    await prisma.business.delete({ where: { id: business.id } });
    await prisma.account.delete({ where: { id: account.id } });
  });
});
