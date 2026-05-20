import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaAccountProvisionRepository } from "./prisma-account-provision.repository";

describe("PrismaAccountProvisionRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaAccountProvisionRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAccountProvisionRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();
    repo = module.get(PrismaAccountProvisionRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists clerkOrganizationId on the account row", async () => {
    const clerkId = `user_${randomUUID()}`;
    const orgId = `org_${randomUUID()}`;

    await repo.create({
      clerkId,
      clerkOrganizationId: orgId,
      email: `owner-${randomUUID()}@example.com`,
      name: "Owner",
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt: new Date(),
    });
    const row = await prisma.account.findUnique({ where: { clerkId } });
    expect(row?.clerkOrganizationId).toBe(orgId);
  });

  it("creates an Account and an owner User in a single transaction", async () => {
    const clerkId = `user_${randomUUID()}`;
    const email = `t-${randomUUID()}@example.com`;

    await repo.create({
      clerkId,
      clerkOrganizationId: `org_${randomUUID()}`,
      email,
      name: "Test User",
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt: new Date(),
    });

    const account = await prisma.account.findUnique({ where: { clerkId } });
    expect(account).not.toBeNull();

    const users = await prisma.user.findMany({ where: { accountId: account!.id } });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(email);
    expect(users[0].role).toBe("owner");
    expect(users[0].name).toBe("Test User");
    expect(users[0].clerkUserId).toBe(clerkId);
  });

  it("rolls back the Account if the User insert fails (e.g. duplicate email)", async () => {
    const sharedEmail = `dup-${randomUUID()}@example.com`;

    await repo.create({
      clerkId: `user_${randomUUID()}`,
      clerkOrganizationId: `org_${randomUUID()}`,
      email: sharedEmail,
      name: "First",
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt: new Date(),
    });

    const conflictClerkId = `user_${randomUUID()}`;
    await expect(
      repo.create({
        clerkId: conflictClerkId,
        clerkOrganizationId: `org_${randomUUID()}`,
        email: sharedEmail,
        name: "Second",
        plan: null,
        status: "trial",
        maxBusinesses: 1,
        trialEndsAt: new Date(),
      }),
    ).rejects.toThrow();

    const orphan = await prisma.account.findUnique({ where: { clerkId: conflictClerkId } });
    expect(orphan).toBeNull();
  });

  it("findByClerkId returns the existing account once provisioned", async () => {
    const clerkId = `user_${randomUUID()}`;
    await repo.create({
      clerkId,
      clerkOrganizationId: `org_${randomUUID()}`,
      email: `t-${randomUUID()}@example.com`,
      name: "Owner",
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt: new Date(),
    });

    const found = await repo.findByClerkId(clerkId);
    expect(found).toEqual({ clerkId });
  });
});
