import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { Connection } from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { PrismaConnectionRepository } from "./prisma-connection.repository";

const KEY = "a".repeat(64);

describe("Worker PrismaConnectionRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaConnectionRepository;
  let businessId: string;
  let accountId: string;
  let connectionId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaConnectionRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => KEY } },
      ],
    }).compile();
    repo = module.get(PrismaConnectionRepository);
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

    const seed = Connection.create(
      {
        businessId,
        provider: "quickbooks",
        accessToken: "old-access",
        refreshToken: "old-refresh",
        tokenExpiresAt: new Date(Date.now() + 5 * 60_000),
        externalTenantId: "realm-1",
        scopes: "s",
      },
      KEY,
    );
    const row = await prisma.connection.create({
      data: {
        businessId,
        provider: "quickbooks",
        accessToken: seed.encryptedAccessToken,
        refreshToken: seed.encryptedRefreshToken,
        tokenExpiresAt: seed.tokenExpiresAt,
        realmId: seed.externalTenantId,
        scopes: seed.scopes,
        status: "connected",
      },
    });
    connectionId = row.id;
  });

  afterEach(async () => {
    await prisma.connection.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  it("findDueForRefresh returns the seeded connection when expiring soon", async () => {
    const cutoff = new Date(Date.now() + 15 * 60_000);
    const due = await repo.findDueForRefresh(cutoff);
    expect(due.map((c) => c.id)).toContain(connectionId);
  });

  it("refreshConnection rotates tokens end to end", async () => {
    const outcome = await repo.refreshConnection(connectionId, async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));

    expect(outcome.kind).toEqual("refreshed");
    const row = await prisma.connection.findFirst({ where: { id: connectionId } });
    expect(row?.lastRefreshAt).not.toBeNull();
  });

  it("updateStatus writes both status and errorMessage", async () => {
    await repo.updateStatus(connectionId, "revoked", "User revoked access");
    const row = await prisma.connection.findFirst({ where: { id: connectionId } });
    expect(row?.status).toEqual("revoked");
    expect(row?.errorMessage).toEqual("User revoked access");
  });

  it("refreshConnection returns skipped=lock_held when the advisory lock is already held", async () => {
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((r) => (releaseGate = r));

    const holder = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${connectionId}, 0))
      `;
      await gate;
    });

    await new Promise((r) => setTimeout(r, 100));

    const callback = jest.fn();
    const outcome = await repo.refreshConnection(connectionId, callback);
    expect(outcome).toEqual({ kind: "skipped", reason: "lock_held" });
    expect(callback).not.toHaveBeenCalled();

    releaseGate();
    await holder;
  });
});
