import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { randomUUID } from "crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { QuickbooksOAuthProvider } from "../quickbooks-oauth/domain/quickbooks-oauth.provider";
import { XeroOAuthProvider } from "../xero-oauth/domain/xero-oauth.provider";

describe("Connections E2E", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let businessId: string;
  let accountId: string;

  const qbMock = {
    name: "quickbooks" as const,
    scopes: "com.intuit.quickbooks.accounting",
    buildAuthUrl: jest.fn(),
    exchangeCode: jest.fn(),
    resolveTenantId: jest.fn(),
  };
  const xeroMock = {
    name: "xero" as const,
    scopes: "openid",
    buildAuthUrl: jest.fn(),
    exchangeCode: jest.fn(),
    resolveTenantId: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QuickbooksOAuthProvider)
      .useValue(qbMock)
      .overrideProvider(XeroOAuthProvider)
      .useValue(xeroMock)
      .compile();

    app = module.createNestApplication();
    await app.init();
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const account = await prisma.account.create({
      data: {
        name: "T",
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
        name: "B",
        accountingProvider: "xero",
        senderName: "S",
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

  it("POST /v1/connections/authorize returns the provider auth URL (Xero)", async () => {
    xeroMock.buildAuthUrl.mockResolvedValue(
      "https://login.xero.com/authorize?state=abc",
    );

    const res = await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({ businessId, provider: "xero" })
      .expect(200);

    expect(res.body).toEqual({
      data: { oauthUrl: "https://login.xero.com/authorize?state=abc" },
    });
    expect(xeroMock.buildAuthUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("GET /v1/connections/xero/callback completes end-to-end: persists + redirects success", async () => {
    let capturedState = "";
    xeroMock.buildAuthUrl.mockImplementation(async (state: string) => {
      capturedState = state;
      return `https://login.xero.com/?state=${state}`;
    });
    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({ businessId, provider: "xero" })
      .expect(200);

    xeroMock.exchangeCode.mockResolvedValue({
      accessToken: "at-xero",
      refreshToken: "rt-xero",
      expiresAt: new Date(Date.now() + 1_800_000),
    });
    xeroMock.resolveTenantId.mockResolvedValue("tenant-abc");

    await request(app.getHttpServer())
      .get("/v1/connections/xero/callback")
      .query({ code: "c-xero", state: capturedState })
      .expect(302)
      .expect(/onboarding\/complete\?status=success$/);

    const row = await prisma.connection.findFirst({
      where: { businessId, provider: "xero" },
    });
    expect(row).not.toBeNull();
    expect(row?.realmId).toEqual("tenant-abc");
    expect(row?.status).toEqual("connected");
    expect(row?.accessToken).not.toEqual("at-xero"); // encrypted
  });

  it("Xero callback with bad state redirects with reason=invalid_state", async () => {
    await request(app.getHttpServer())
      .get("/v1/connections/xero/callback")
      .query({ code: "c", state: "never-minted" })
      .expect(302)
      .expect(/reason=invalid_state$/);
  });

  it("Xero callback with provider-mismatch state redirects with reason=invalid_state", async () => {
    let capturedState = "";
    qbMock.buildAuthUrl.mockImplementation(async (state: string) => {
      capturedState = state;
      return `https://appcenter.intuit.com/?state=${state}`;
    });
    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({ businessId, provider: "quickbooks" })
      .expect(200);

    await request(app.getHttpServer())
      .get("/v1/connections/xero/callback")
      .query({ code: "c", state: capturedState })
      .expect(302)
      .expect(/reason=invalid_state$/);
  });

  it("allows QB and Xero connections to coexist for the same business", async () => {
    const priming = async (provider: "quickbooks" | "xero") => {
      let captured = "";
      const mock = provider === "xero" ? xeroMock : qbMock;
      mock.buildAuthUrl.mockImplementation(async (state: string) => {
        captured = state;
        return "http://x";
      });
      mock.exchangeCode.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: new Date(Date.now() + 1_800_000),
      });
      mock.resolveTenantId.mockResolvedValue(`external-${provider}`);

      await request(app.getHttpServer())
        .post("/v1/connections/authorize")
        .send({ businessId, provider })
        .expect(200);
      await request(app.getHttpServer())
        .get(`/v1/connections/${provider}/callback`)
        .query(
          provider === "quickbooks"
            ? { code: "c", state: captured, realmId: "r" }
            : { code: "c", state: captured },
        )
        .expect(302);
    };

    await priming("quickbooks");
    await priming("xero");

    const rows = await prisma.connection.findMany({
      where: { businessId },
      orderBy: { provider: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.provider).sort()).toEqual(["quickbooks", "xero"]);
  });
});
