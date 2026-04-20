const mockCreateToken = jest.fn();
const mockAuthorizeUri = jest.fn();
const mockRefresh = jest.fn();

jest.mock("intuit-oauth", () => {
  const MockOAuthClient = jest.fn().mockImplementation(() => ({
    createToken: mockCreateToken,
    authorizeUri: mockAuthorizeUri,
    refreshUsingToken: mockRefresh,
  })) as jest.Mock & { scopes: Record<string, string> };
  MockOAuthClient.scopes = { Accounting: "com.intuit.quickbooks.accounting" };
  return MockOAuthClient;
});

import { QuickbooksOAuthProvider } from "./quickbooks-oauth.provider";
import {
  RefreshFailedError,
  RefreshTokenExpiredError,
  TokenRevokedError,
} from "@nudge/connections-domain";

describe("QuickbooksOAuthProvider", () => {
  let provider: QuickbooksOAuthProvider;
  const config = {
    get: jest.fn((k: string) => {
      const v: Record<string, string> = {
        QUICKBOOKS_CLIENT_ID: "cid",
        QUICKBOOKS_CLIENT_SECRET: "secret",
        QUICKBOOKS_ENVIRONMENT: "sandbox",
        QUICKBOOKS_REDIRECT_URI:
          "http://localhost:3000/v1/connections/quickbooks/callback",
      };
      return v[k];
    }),
  };

  beforeEach(() => {
    mockCreateToken.mockReset();
    mockAuthorizeUri.mockReset();
    mockRefresh.mockReset();
    provider = new QuickbooksOAuthProvider(config as never);
  });

  describe("buildAuthUrl", () => {
    it("calls intuit-oauth authorizeUri with accounting scope and state", async () => {
      mockAuthorizeUri.mockReturnValue("https://appcenter.intuit.com/?state=s");
      const url = await provider.buildAuthUrl("s");
      expect(url).toEqual("https://appcenter.intuit.com/?state=s");
      expect(mockAuthorizeUri).toHaveBeenCalledWith({
        scope: ["com.intuit.quickbooks.accounting"],
        state: "s",
      });
    });
  });

  describe("exchangeCode", () => {
    it("calls createToken with redirect URI carrying code and realmId", async () => {
      mockCreateToken.mockResolvedValue({
        getJson: () => ({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
      });
      const tokens = await provider.exchangeCode("c", "s", { realmId: "r" });
      expect(mockCreateToken).toHaveBeenCalledWith(
        "http://localhost:3000/v1/connections/quickbooks/callback?code=c&realmId=r",
      );
      expect(tokens.accessToken).toEqual("at");
      expect(tokens.refreshToken).toEqual("rt");
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("resolveTenantId", () => {
    it("returns metadata.realmId directly", async () => {
      const id = await provider.resolveTenantId(
        {
          accessToken: "a",
          refreshToken: "r",
          expiresAt: new Date(),
        },
        { realmId: "realm-123" },
      );
      expect(id).toEqual("realm-123");
    });

    it("throws if realmId is missing", async () => {
      await expect(
        provider.resolveTenantId(
          { accessToken: "a", refreshToken: "r", expiresAt: new Date() },
          {},
        ),
      ).rejects.toThrow(/realmId/);
    });
  });

  describe("refreshTokens", () => {
    it("returns new ProviderTokens on success", async () => {
      mockRefresh.mockResolvedValue({
        getJson: () => ({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        }),
      });

      const result = await provider.refreshTokens("old-refresh");

      expect(mockRefresh).toHaveBeenCalledWith("old-refresh");
      expect(result.accessToken).toEqual("new-access");
      expect(result.refreshToken).toEqual("new-refresh");
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("throws RefreshTokenExpiredError on invalid_grant", async () => {
      mockRefresh.mockRejectedValue(
        Object.assign(new Error("refresh failed"), {
          authResponse: { json: { error: "invalid_grant" }, response: { status: 401 } },
        }),
      );

      await expect(provider.refreshTokens("old")).rejects.toBeInstanceOf(
        RefreshTokenExpiredError,
      );
    });

    it("throws TokenRevokedError on non-invalid_grant 401", async () => {
      mockRefresh.mockRejectedValue(
        Object.assign(new Error("unauthorized"), {
          authResponse: { json: { error: "invalid_token" }, response: { status: 401 } },
        }),
      );

      await expect(provider.refreshTokens("old")).rejects.toBeInstanceOf(
        TokenRevokedError,
      );
    });

    it("throws RefreshFailedError on 5xx", async () => {
      mockRefresh.mockRejectedValue(
        Object.assign(new Error("server error"), {
          authResponse: { response: { status: 503 } },
        }),
      );

      await expect(provider.refreshTokens("old")).rejects.toBeInstanceOf(
        RefreshFailedError,
      );
    });

    it("throws RefreshFailedError on 429", async () => {
      mockRefresh.mockRejectedValue(
        Object.assign(new Error("rate limited"), {
          authResponse: { response: { status: 429 } },
        }),
      );

      await expect(provider.refreshTokens("old")).rejects.toBeInstanceOf(
        RefreshFailedError,
      );
    });

    it("throws RefreshFailedError on network error (no authResponse)", async () => {
      mockRefresh.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(provider.refreshTokens("old")).rejects.toBeInstanceOf(
        RefreshFailedError,
      );
    });
  });
});
