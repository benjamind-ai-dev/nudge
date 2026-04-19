import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";
import { PRISMA_CLIENT } from "../../common/database/database.module";
import { REDIS_CLIENT } from "../../common/redis/redis.module";

const mockCreateToken = jest.fn();
const mockAuthorizeUri = jest.fn();

jest.mock("intuit-oauth", () => {
  const MockOAuthClient = jest.fn().mockImplementation(() => ({
    createToken: mockCreateToken,
    authorizeUri: mockAuthorizeUri,
  })) as jest.Mock & { scopes: Record<string, string> };
  MockOAuthClient.scopes = {
    Accounting: "com.intuit.quickbooks.accounting",
  };
  return MockOAuthClient;
});

describe("QuickbooksOAuthService", () => {
  let service: QuickbooksOAuthService;
  let prisma: {
    business: { findUnique: jest.Mock };
    connection: { upsert: jest.Mock };
  };
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };
  let config: { get: jest.Mock };
  let invoiceSyncQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      business: { findUnique: jest.fn() },
      connection: { upsert: jest.fn() },
    };
    redis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          QUICKBOOKS_CLIENT_ID: "test-client-id",
          QUICKBOOKS_CLIENT_SECRET: "test-client-secret",
          QUICKBOOKS_REDIRECT_URI:
            "http://localhost:3000/v1/connections/quickbooks/callback",
          QUICKBOOKS_ENVIRONMENT: "sandbox",
          ENCRYPTION_KEY: "a".repeat(64),
          FRONTEND_URL: "http://localhost:5173",
        };
        return values[key];
      }),
    };
    invoiceSyncQueue = { add: jest.fn().mockResolvedValue({}) };

    mockCreateToken.mockReset();
    mockAuthorizeUri.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        QuickbooksOAuthService,
        { provide: PRISMA_CLIENT, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: config },
        {
          provide: getQueueToken(QUEUE_NAMES.INVOICE_SYNC),
          useValue: invoiceSyncQueue,
        },
      ],
    }).compile();

    service = module.get(QuickbooksOAuthService);
  });

  describe("authorize", () => {
    const businessId = "550e8400-e29b-41d4-a716-446655440000";

    it("returns an OAuth URL from the Intuit SDK", async () => {
      prisma.business.findUnique.mockResolvedValue({ id: businessId });
      mockAuthorizeUri.mockReturnValue(
        "https://appcenter.intuit.com/connect/oauth2?client_id=test-client-id&scope=com.intuit.quickbooks.accounting&state=abc123",
      );

      const result = await service.authorize(businessId);

      expect(result.oauthUrl).toContain(
        "https://appcenter.intuit.com/connect/oauth2",
      );
      expect(mockAuthorizeUri).toHaveBeenCalledWith({
        scope: ["com.intuit.quickbooks.accounting"],
        state: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
    });

    it("stores state token in Redis with 10-minute TTL", async () => {
      prisma.business.findUnique.mockResolvedValue({ id: businessId });
      mockAuthorizeUri.mockReturnValue("https://example.com?state=abc");

      await service.authorize(businessId);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth:state:[a-f0-9]{64}$/),
        businessId,
        "EX",
        600,
      );
    });

    it("throws NotFoundException when business does not exist", async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.authorize(businessId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("callback", () => {
    const state = "abc123";
    const code = "auth-code-from-intuit";
    const realmId = "realm-456";
    const businessId = "550e8400-e29b-41d4-a716-446655440000";

    it("returns success redirect URL on valid flow", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      const result = await service.callback(code, state, realmId);

      expect(result).toEqual(
        "http://localhost:5173/onboarding/complete?status=success",
      );
    });

    it("calls createToken with the redirect URI including code and realmId", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      expect(mockCreateToken).toHaveBeenCalledWith(
        `http://localhost:3000/v1/connections/quickbooks/callback?code=${code}&realmId=${realmId}`,
      );
    });

    it("deletes state token from Redis after reading", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      expect(redis.del).toHaveBeenCalledWith(`oauth:state:${state}`);
    });

    it("stores encrypted tokens in the connection record", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      const upsertCall = prisma.connection.upsert.mock.calls[0][0];
      expect(upsertCall.create.accessToken).not.toEqual("at-123");
      expect(upsertCall.create.refreshToken).not.toEqual("rt-456");
      expect(upsertCall.create.accessToken.split(":")).toHaveLength(3);
      expect(upsertCall.create.refreshToken.split(":")).toHaveLength(3);
      expect(upsertCall.create.provider).toEqual("quickbooks");
      expect(upsertCall.create.realmId).toEqual(realmId);
      expect(upsertCall.create.status).toEqual("connected");
    });

    it("enqueues invoice-sync job after storing connection", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      expect(invoiceSyncQueue.add).toHaveBeenCalledWith("invoice-sync", {
        businessId,
      });
    });

    it("returns error redirect when state token is missing", async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.callback(code, state, realmId);

      expect(result).toEqual(
        "http://localhost:5173/onboarding/complete?status=error&reason=invalid_state",
      );
    });

    it("returns error redirect when token exchange fails", async () => {
      redis.get.mockResolvedValue(businessId);
      mockCreateToken.mockRejectedValue(new Error("Token exchange failed"));

      const result = await service.callback(code, state, realmId);

      expect(result).toEqual(
        "http://localhost:5173/onboarding/complete?status=error&reason=token_exchange_failed",
      );
    });
  });
});
