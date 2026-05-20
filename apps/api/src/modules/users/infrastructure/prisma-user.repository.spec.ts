import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaUserRepository } from "./prisma-user.repository";
import { EmailAlreadyInUseError } from "../domain/user.errors";

describe("PrismaUserRepository (invite methods)", () => {
  let prisma: PrismaClient;
  let repo: PrismaUserRepository;
  let ACCOUNT_ID: string;
  let OTHER_ACCOUNT_ID: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
      ],
    }).compile();

    repo = module.get(PrismaUserRepository);
  });

  beforeEach(async () => {
    // Create two accounts with owner users for test isolation
    const clerkId1 = `user_${randomUUID()}`;
    const account1 = await prisma.account.create({
      data: {
        clerkId: clerkId1,
        name: "Test Account 1",
        email: `account1-${randomUUID()}@example.com`,
        status: "trial",
        plan: null,
        maxBusinesses: 1,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        users: {
          create: {
            email: `owner1-${randomUUID()}@example.com`,
            name: "Owner 1",
            role: "owner",
            clerkUserId: clerkId1,
          },
        },
      },
    });
    ACCOUNT_ID = account1.id;

    const clerkId2 = `user_${randomUUID()}`;
    const account2 = await prisma.account.create({
      data: {
        clerkId: clerkId2,
        name: "Test Account 2",
        email: `account2-${randomUUID()}@example.com`,
        status: "trial",
        plan: null,
        maxBusinesses: 1,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        users: {
          create: {
            email: `owner2-${randomUUID()}@example.com`,
            name: "Owner 2",
            role: "owner",
            clerkUserId: clerkId2,
          },
        },
      },
    });
    OTHER_ACCOUNT_ID = account2.id;
  });

  afterEach(async () => {
    // Clean up created accounts (cascades to users)
    await prisma.user.deleteMany({
      where: { accountId: { in: [ACCOUNT_ID, OTHER_ACCOUNT_ID] } },
    });
    await prisma.account.deleteMany({
      where: { id: { in: [ACCOUNT_ID, OTHER_ACCOUNT_ID] } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("findByEmailInAccount returns null when email exists only in another account", async () => {
    await repo.createPending({
      accountId: ACCOUNT_ID,
      email: `x-${randomUUID()}@example.com`,
      name: "X",
      role: "viewer",
    });
    // Use a fresh email created in ACCOUNT_ID and look for it in OTHER_ACCOUNT_ID
    const pendingEmail = `find-test-${randomUUID()}@example.com`;
    await repo.createPending({
      accountId: ACCOUNT_ID,
      email: pendingEmail,
      name: "X",
      role: "viewer",
    });
    const found = await repo.findByEmailInAccount(pendingEmail, OTHER_ACCOUNT_ID);
    expect(found).toBeNull();
  });

  it("findByEmailInAccount returns the row when it exists in the same account", async () => {
    const email = `y-${randomUUID()}@example.com`;
    await repo.createPending({ accountId: ACCOUNT_ID, email, name: "Y", role: "admin" });
    const found = await repo.findByEmailInAccount(email, ACCOUNT_ID);
    expect(found?.email).toBe(email);
    expect(found?.clerkUserId).toBeNull();
  });

  it("createPending writes a row with clerkUserId null and the requested role", async () => {
    const email = `z-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "Z",
      role: "viewer",
    });
    expect(row.role).toBe("viewer");
    expect(row.clerkUserId).toBeNull();
  });

  it("createPending throws EmailAlreadyInUseError on global-unique email collision", async () => {
    const email = `dup-${randomUUID()}@example.com`;
    await repo.createPending({
      accountId: OTHER_ACCOUNT_ID,
      email,
      name: "Dup",
      role: "viewer",
    });
    await expect(
      repo.createPending({ accountId: ACCOUNT_ID, email, name: "Dup", role: "viewer" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it("deleteById removes the row", async () => {
    const email = `d-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "D",
      role: "viewer",
    });
    expect(await repo.deleteById(row.id, ACCOUNT_ID)).toBe(1);
    expect(await repo.findByEmailInAccount(email, ACCOUNT_ID)).toBeNull();
  });

  it("linkClerkUserId updates the matching pending row and returns it", async () => {
    const email = `l-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "L",
      role: "admin",
    });
    const updated = await repo.linkClerkUserId({
      userId: row.id,
      accountId: ACCOUNT_ID,
      clerkUserId: "user_clerk_xyz",
    });
    expect(updated?.clerkUserId).toBe("user_clerk_xyz");
  });

  it("linkClerkUserId returns null when accountId mismatches", async () => {
    const email = `m-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "M",
      role: "viewer",
    });
    const updated = await repo.linkClerkUserId({
      userId: row.id,
      accountId: OTHER_ACCOUNT_ID,
      clerkUserId: "user_clerk_xyz",
    });
    expect(updated).toBeNull();
  });

  it("linkClerkUserId is a no-op when row is already linked to the same clerkUserId", async () => {
    const email = `n-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "N",
      role: "viewer",
    });
    await repo.linkClerkUserId({ userId: row.id, accountId: ACCOUNT_ID, clerkUserId: "user_clerk_n" });
    const second = await repo.linkClerkUserId({
      userId: row.id,
      accountId: ACCOUNT_ID,
      clerkUserId: "user_clerk_n",
    });
    expect(second?.clerkUserId).toBe("user_clerk_n");
  });

  it("linkClerkUserId returns null when row is already linked to a DIFFERENT clerkUserId", async () => {
    const email = `o-${randomUUID()}@example.com`;
    const row = await repo.createPending({
      accountId: ACCOUNT_ID,
      email,
      name: "O",
      role: "viewer",
    });
    await repo.linkClerkUserId({ userId: row.id, accountId: ACCOUNT_ID, clerkUserId: "user_clerk_o1" });
    const second = await repo.linkClerkUserId({
      userId: row.id,
      accountId: ACCOUNT_ID,
      clerkUserId: "user_clerk_o2",
    });
    expect(second).toBeNull();
  });

  describe("clerkInvitationId persistence", () => {
    it("createPending stores clerkInvitationId when provided", async () => {
      const email = `pending-${randomUUID()}@example.com`;
      const created = await repo.createPending({
        accountId: ACCOUNT_ID,
        email,
        name: "Pending",
        role: "viewer",
        clerkInvitationId: "inv_init",
      });
      expect(created.clerkInvitationId).toBe("inv_init");
    });

    it("createPending defaults clerkInvitationId to null when omitted", async () => {
      const email = `pending-${randomUUID()}@example.com`;
      const created = await repo.createPending({
        accountId: ACCOUNT_ID,
        email,
        name: "Pending",
        role: "viewer",
      });
      expect(created.clerkInvitationId).toBeNull();
    });

    it("setClerkInvitationId updates the row and returns 1", async () => {
      const email = `pending-${randomUUID()}@example.com`;
      const created = await repo.createPending({
        accountId: ACCOUNT_ID,
        email,
        name: "Pending",
        role: "viewer",
      });
      const count = await repo.setClerkInvitationId(created.id, ACCOUNT_ID, "inv_new");
      expect(count).toBe(1);
      const refetched = await repo.findByIdInAccount(created.id, ACCOUNT_ID);
      expect(refetched?.clerkInvitationId).toBe("inv_new");
    });

    it("setClerkInvitationId is tenant-scoped — returns 0 for wrong account", async () => {
      const email = `pending-${randomUUID()}@example.com`;
      const created = await repo.createPending({
        accountId: ACCOUNT_ID,
        email,
        name: "Pending",
        role: "viewer",
      });
      const count = await repo.setClerkInvitationId(created.id, OTHER_ACCOUNT_ID, "inv_x");
      expect(count).toBe(0);
    });

    it("setClerkInvitationId(null) clears the column", async () => {
      const email = `pending-${randomUUID()}@example.com`;
      const created = await repo.createPending({
        accountId: ACCOUNT_ID,
        email,
        name: "Pending",
        role: "viewer",
        clerkInvitationId: "inv_init",
      });
      await repo.setClerkInvitationId(created.id, ACCOUNT_ID, null);
      const refetched = await repo.findByIdInAccount(created.id, ACCOUNT_ID);
      expect(refetched?.clerkInvitationId).toBeNull();
    });
  });
});
