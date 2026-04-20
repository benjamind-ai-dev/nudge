const mockCreateToken = jest.fn();
const mockAuthorizeUri = jest.fn();

jest.mock("intuit-oauth", () => {
  const MockOAuthClient = jest.fn().mockImplementation(() => ({
    createToken: mockCreateToken,
    authorizeUri: mockAuthorizeUri,
  })) as jest.Mock & { scopes: Record<string, string> };
  MockOAuthClient.scopes = { Accounting: "com.intuit.quickbooks.accounting" };
  return MockOAuthClient;
});

import { QuickbooksOAuthProvider } from "./quickbooks-oauth.provider";

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
});
