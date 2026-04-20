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
});
