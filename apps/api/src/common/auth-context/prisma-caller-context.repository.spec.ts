import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PrismaCallerContextRepository } from "./prisma-caller-context.repository";

describe("PrismaCallerContextRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaCallerContextRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    repo = new PrismaCallerContextRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns caller context for an existing user", async () => {
    const clerkUserId = `user_${randomUUID()}`;
    const account = await prisma.account.create({
      data: {
        name: "Acc",
        email: `acc-${randomUUID()}@t.io`,
        plan: null,
        status: "trial",
        maxBusinesses: 1,
        clerkId: clerkUserId,
      },
    });
    const user = await prisma.user.create({
      data: {
        accountId: account.id,
        email: `u-${randomUUID()}@t.io`,
        name: "Owner",
        role: "owner",
        clerkUserId,
      },
    });

    const result = await repo.findByClerkUserId(clerkUserId);

    expect(result).toEqual({
      userId: user.id,
      accountId: account.id,
      role: "owner",
    });
  });

  it("returns null when no user matches", async () => {
    const result = await repo.findByClerkUserId(`user_missing_${randomUUID()}`);
    expect(result).toBeNull();
  });
});
