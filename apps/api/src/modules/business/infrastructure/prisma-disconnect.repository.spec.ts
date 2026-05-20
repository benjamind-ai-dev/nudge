import { PrismaClient } from "@nudge/database";
import { Connection } from "@nudge/connections-domain";
import { Env } from "../../../common/config/env.schema";
import { ConfigService } from "@nestjs/config";
import { PrismaDisconnectRepository } from "./prisma-disconnect.repository";

const ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex — matches connections spec

describe("PrismaDisconnectRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaDisconnectRepository;
  const config = {
    get: jest.fn((key: string) =>
      key === "ENCRYPTION_KEY" ? ENCRYPTION_KEY : undefined,
    ),
  } as unknown as ConfigService<Env, true>;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean order respects FK constraints.
    await prisma.sequenceRun.deleteMany();
    await prisma.message.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.connection.deleteMany();
    await prisma.business.deleteMany();
    await prisma.account.deleteMany();

    repo = new PrismaDisconnectRepository(prisma, config);
  });

  async function seedBusinessWithConnection(provider: "quickbooks" | "xero") {
    const account = await prisma.account.create({
      data: {
        name: "Test Account",
        email: `t-${Date.now()}@t.io`,
        plan: "starter",
        status: "active",
        maxBusinesses: 1,
      },
    });
    const business = await prisma.business.create({
      data: {
        accountId: account.id,
        name: "Acme",
        accountingProvider: provider,
        senderName: "S",
        senderEmail: "s@s.io",
        timezone: "UTC",
      },
    });
    const conn = Connection.create(
      {
        businessId: business.id,
        provider,
        accessToken: "AT",
        refreshToken: "RT",
        tokenExpiresAt: new Date(Date.now() + 60_000),
        externalTenantId: "tenant",
        scopes: "all",
      },
      ENCRYPTION_KEY,
    );
    const connRow = await prisma.connection.create({
      data: {
        businessId: business.id,
        provider,
        accessToken: conn.encryptedAccessToken,
        refreshToken: conn.encryptedRefreshToken,
        tokenExpiresAt: conn.tokenExpiresAt,
        realmId: "tenant",
        scopes: "all",
        status: "connected",
      },
    });
    return { account, business, conn: connRow };
  }

  it("findActiveConnections returns connected rows with decrypted refreshToken", async () => {
    const { business } = await seedBusinessWithConnection("quickbooks");

    const active = await repo.findActiveConnections(business.id);

    expect(active).toHaveLength(1);
    expect(active[0].provider).toEqual("quickbooks");
    expect(active[0].refreshToken).toEqual("RT");
  });

  it("findActiveConnections skips non-connected statuses", async () => {
    const { business, conn } = await seedBusinessWithConnection("xero");
    await prisma.connection.update({ where: { id: conn.id }, data: { status: "revoked" } });

    const active = await repo.findActiveConnections(business.id);

    expect(active).toEqual([]);
  });

  it("runDisconnect revokes connections and deactivates business atomically", async () => {
    // Sequence-run stopping is in the same $transaction; the runs-stop path
    // is unit-tested separately. Here we seed zero active runs and verify
    // the connection-revoke + business-deactivate writes commit atomically.
    const { business, conn } = await seedBusinessWithConnection("quickbooks");

    const result = await repo.runDisconnect(business.id);

    expect(result.stoppedRunCount).toEqual(0);
    expect(result.revokedConnectionCount).toEqual(1);

    const businessAfter = await prisma.business.findUnique({ where: { id: business.id } });
    expect(businessAfter?.isActive).toEqual(false);

    const connAfter = await prisma.connection.findUnique({ where: { id: conn.id } });
    expect(connAfter?.status).toEqual("revoked");
    expect(connAfter?.errorMessage).toEqual("manually_disconnected");
  });

  it("runDisconnect is idempotent — second call returns zeros", async () => {
    const { business } = await seedBusinessWithConnection("quickbooks");
    await repo.runDisconnect(business.id);

    const result = await repo.runDisconnect(business.id);

    expect(result.stoppedRunCount).toEqual(0);
    expect(result.revokedConnectionCount).toEqual(0);
  });
});
