import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { Connection } from "@nudge/connections-domain";
import { PrismaConnectionRepository } from "./prisma-connection.repository";

const KEY = "a".repeat(64);

describe("PrismaConnectionRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaConnectionRepository;
  let businessId: string;
  let accountId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const module = await Test.createTestingModule({
      providers: [
        PrismaConnectionRepository,
        { provide: PRISMA_CLIENT, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: () => KEY },
        },
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
  });

  afterEach(async () => {
    await prisma.connection.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.account.deleteMany({ where: { id: accountId } });
  });

  it("inserts a new connection via upsertByBusinessAndProvider", async () => {
    const conn = Connection.create(
      {
        businessId,
        provider: "quickbooks",
        accessToken: "at",
        refreshToken: "rt",
        tokenExpiresAt: new Date("2030-01-01"),
        externalTenantId: "realm-1",
        scopes: "s",
      },
      KEY,
    );

    const saved = await repo.upsertByBusinessAndProvider(conn);
    expect(saved.id).not.toBeNull();

    const fromDb = await prisma.connection.findFirst({
      where: { businessId, provider: "quickbooks" },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.realmId).toEqual("realm-1");
    expect(fromDb?.status).toEqual("connected");
  });

  it("allows two providers for the same business", async () => {
    const qb = Connection.create(
      {
        businessId,
        provider: "quickbooks",
        accessToken: "at-qb",
        refreshToken: "rt-qb",
        tokenExpiresAt: new Date("2030-01-01"),
        externalTenantId: "realm-1",
        scopes: "s",
      },
      KEY,
    );
    const xero = Connection.create(
      {
        businessId,
        provider: "xero",
        accessToken: "at-x",
        refreshToken: "rt-x",
        tokenExpiresAt: new Date("2030-01-01"),
        externalTenantId: "tenant-1",
        scopes: "s",
      },
      KEY,
    );
    await repo.upsertByBusinessAndProvider(qb);
    await repo.upsertByBusinessAndProvider(xero);

    const rows = await prisma.connection.findMany({ where: { businessId } });
    expect(rows).toHaveLength(2);
  });

  it("updates an existing row for the same (business, provider) pair", async () => {
    const first = Connection.create(
      {
        businessId,
        provider: "quickbooks",
        accessToken: "at-1",
        refreshToken: "rt-1",
        tokenExpiresAt: new Date("2030-01-01"),
        externalTenantId: "realm-1",
        scopes: "s",
      },
      KEY,
    );
    await repo.upsertByBusinessAndProvider(first);

    const second = Connection.create(
      {
        businessId,
        provider: "quickbooks",
        accessToken: "at-2",
        refreshToken: "rt-2",
        tokenExpiresAt: new Date("2031-01-01"),
        externalTenantId: "realm-1",
        scopes: "s",
      },
      KEY,
    );
    await repo.upsertByBusinessAndProvider(second);

    const rows = await prisma.connection.findMany({ where: { businessId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenExpiresAt.toISOString()).toEqual(
      "2031-01-01T00:00:00.000Z",
    );
  });

  it("findByBusinessAndProvider rehydrates a Connection with decryptable tokens", async () => {
    const conn = Connection.create(
      {
        businessId,
        provider: "xero",
        accessToken: "secret-access",
        refreshToken: "secret-refresh",
        tokenExpiresAt: new Date("2030-01-01"),
        externalTenantId: "tenant-1",
        scopes: "s",
      },
      KEY,
    );
    await repo.upsertByBusinessAndProvider(conn);

    const found = await repo.findByBusinessAndProvider(businessId, "xero");
    expect(found).not.toBeNull();
    expect(found?.accessToken).toEqual("secret-access");
    expect(found?.refreshToken).toEqual("secret-refresh");
  });

  describe("findById", () => {
    it("returns null for missing id", async () => {
      const found = await repo.findById("00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });

    it("returns the Connection for an existing id", async () => {
      const conn = Connection.create(
        {
          businessId,
          provider: "xero",
          accessToken: "at",
          refreshToken: "rt",
          tokenExpiresAt: new Date("2030-01-01"),
          externalTenantId: "tenant-1",
          scopes: "s",
        },
        KEY,
      );
      const saved = await repo.upsertByBusinessAndProvider(conn);
      const found = await repo.findById(saved.id!);
      expect(found?.id).toEqual(saved.id);
    });
  });

  describe("findDueForRefresh", () => {
    it("returns only connections with status=connected and tokenExpiresAt < cutoff", async () => {
      const soon = new Date(Date.now() + 5 * 60_000);
      const later = new Date(Date.now() + 60 * 60_000);

      await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: soon,
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );
      await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "xero",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: later,
            externalTenantId: "tenant-1",
            scopes: "s",
          },
          KEY,
        ),
      );

      const cutoff = new Date(Date.now() + 15 * 60_000);
      const due = await repo.findDueForRefresh(cutoff);
      expect(due).toHaveLength(1);
      expect(due[0].provider).toEqual("quickbooks");
    });

    it("skips connections with non-connected status", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: new Date(Date.now() + 60_000),
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );
      await repo.updateStatus(saved.id!, "revoked", "User revoked");

      const due = await repo.findDueForRefresh(new Date(Date.now() + 15 * 60_000));
      expect(due).toHaveLength(0);
    });
  });

  describe("updateStatus", () => {
    it("persists status and errorMessage atomically", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "xero",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: new Date("2030-01-01"),
            externalTenantId: "tenant-1",
            scopes: "s",
          },
          KEY,
        ),
      );

      await repo.updateStatus(saved.id!, "error", "5 retries exhausted");

      const row = await prisma.connection.findFirst({ where: { id: saved.id! } });
      expect(row?.status).toEqual("error");
      expect(row?.errorMessage).toEqual("5 retries exhausted");
    });
  });

  describe("refreshConnection", () => {
    it("happy path: runs callback and updates row atomically", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "old-access",
            refreshToken: "old-refresh",
            tokenExpiresAt: new Date("2030-01-01"),
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );

      const outcome = await repo.refreshConnection(saved.id!, async (rt) => {
        expect(rt).toEqual("old-refresh");
        return {
          accessToken: "new-access",
          refreshToken: "new-refresh",
          expiresAt: new Date("2031-01-01"),
        };
      });

      expect(outcome.kind).toEqual("refreshed");

      const found = await repo.findByBusinessAndProvider(businessId, "quickbooks");
      expect(found?.accessToken).toEqual("new-access");
      expect(found?.refreshToken).toEqual("new-refresh");
      expect(found?.tokenExpiresAt.toISOString()).toEqual("2031-01-01T00:00:00.000Z");
    });

    it("returns skipped=status_changed when status is not connected", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: new Date("2030-01-01"),
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );
      await repo.updateStatus(saved.id!, "revoked", "revoked");

      const callback = jest.fn();
      const outcome = await repo.refreshConnection(saved.id!, callback);

      expect(outcome).toEqual({ kind: "skipped", reason: "status_changed" });
      expect(callback).not.toHaveBeenCalled();
    });

    it("returns failed and rolls back when callback throws", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "original-access",
            refreshToken: "original-refresh",
            tokenExpiresAt: new Date("2030-01-01"),
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );

      const boom = new Error("boom");
      const outcome = await repo.refreshConnection(saved.id!, async () => {
        throw boom;
      });

      expect(outcome).toEqual({ kind: "failed", error: boom });

      const found = await repo.findByBusinessAndProvider(businessId, "quickbooks");
      expect(found?.accessToken).toEqual("original-access");
    });

    it("returns skipped=lock_held when another transaction holds the lock", async () => {
      const saved = await repo.upsertByBusinessAndProvider(
        Connection.create(
          {
            businessId,
            provider: "quickbooks",
            accessToken: "at",
            refreshToken: "rt",
            tokenExpiresAt: new Date("2030-01-01"),
            externalTenantId: "realm-1",
            scopes: "s",
          },
          KEY,
        ),
      );

      let releaseGate: () => void = () => {};
      const gate = new Promise<void>((r) => (releaseGate = r));

      const holder = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${saved.id!}, 0))
        `;
        await gate;
      });

      await new Promise((r) => setTimeout(r, 100));

      const callback = jest.fn();
      const outcome = await repo.refreshConnection(saved.id!, callback);
      expect(outcome).toEqual({ kind: "skipped", reason: "lock_held" });
      expect(callback).not.toHaveBeenCalled();

      releaseGate();
      await holder;
    });
  });
});
