import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";
import { PRISMA_CLIENT } from "../../common/database/database.module";
import { REDIS_CLIENT } from "../../common/redis/redis.module";

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
          QUICKBOOKS_REDIRECT_URI: "http://localhost:3000/v1/connections/quickbooks/callback",
          ENCRYPTION_KEY: "a".repeat(64),
          FRONTEND_URL: "http://localhost:5173",
        };
        return values[key];
      }),
    };
    invoiceSyncQueue = { add: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        QuickbooksOAuthService,
        { provide: PRISMA_CLIENT, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(QUEUE_NAMES.INVOICE_SYNC), useValue: invoiceSyncQueue },
      ],
    }).compile();

    service = module.get(QuickbooksOAuthService);
  });

  describe("authorize", () => {
    const businessId = "550e8400-e29b-41d4-a716-446655440000";

    it("returns an OAuth URL with correct params", async () => {
      prisma.business.findUnique.mockResolvedValue({ id: businessId });

      const result = await service.authorize(businessId);

      const url = new URL(result.oauthUrl);
      expect(url.origin + url.pathname).toEqual(
        "https://appcenter.intuit.com/connect/oauth2",
      );
      expect(url.searchParams.get("client_id")).toEqual("test-client-id");
      expect(url.searchParams.get("redirect_uri")).toEqual(
        "http://localhost:3000/v1/connections/quickbooks/callback",
      );
      expect(url.searchParams.get("scope")).toEqual(
        "com.intuit.quickbooks.accounting",
      );
      expect(url.searchParams.get("response_type")).toEqual("code");
      expect(url.searchParams.get("state")).toBeDefined();
      expect(url.searchParams.get("state")!.length).toEqual(64); // 32 bytes hex
    });

    it("stores state token in Redis with 10-minute TTL", async () => {
      prisma.business.findUnique.mockResolvedValue({ id: businessId });

      const result = await service.authorize(businessId);

      const state = new URL(result.oauthUrl).searchParams.get("state")!;
      expect(redis.set).toHaveBeenCalledWith(
        `oauth:state:${state}`,
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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

    it("deletes state token from Redis after reading", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      const upsertCall = prisma.connection.upsert.mock.calls[0][0];
      // Tokens should be encrypted (not plaintext)
      expect(upsertCall.create.accessToken).not.toEqual("at-123");
      expect(upsertCall.create.refreshToken).not.toEqual("rt-456");
      // Encrypted format: iv:authTag:ciphertext
      expect(upsertCall.create.accessToken.split(":")).toHaveLength(3);
      expect(upsertCall.create.refreshToken.split(":")).toHaveLength(3);
      expect(upsertCall.create.provider).toEqual("quickbooks");
      expect(upsertCall.create.realmId).toEqual(realmId);
      expect(upsertCall.create.status).toEqual("connected");
    });

    it("enqueues invoice-sync job after storing connection", async () => {
      redis.get.mockResolvedValue(businessId);
      prisma.connection.upsert.mockResolvedValue({ id: "conn-1" });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
        }),
      });

      await service.callback(code, state, realmId);

      expect(invoiceSyncQueue.add).toHaveBeenCalledWith(
        "invoice-sync",
        { businessId },
      );
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      const result = await service.callback(code, state, realmId);

      expect(result).toEqual(
        "http://localhost:5173/onboarding/complete?status=error&reason=token_exchange_failed",
      );
    });
  });
});
