const mockBuildConsentUrl = jest.fn();
const mockApiCallback = jest.fn();
const mockUpdateTenants = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockSetTokenSet = jest.fn();

jest.mock("xero-node", () => ({
  XeroClient: jest.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    buildConsentUrl: mockBuildConsentUrl,
    apiCallback: mockApiCallback,
    updateTenants: mockUpdateTenants,
    setTokenSet: mockSetTokenSet,
    tenants: [] as Array<{ tenantId: string; tenantName: string }>,
  })),
}));

import { Logger } from "@nestjs/common";
import { XeroClient } from "xero-node";
import { XeroOAuthProvider } from "./xero-oauth.provider";

describe("XeroOAuthProvider", () => {
  let provider: XeroOAuthProvider;
  const config = {
    get: jest.fn((k: string) => {
      const v: Record<string, string> = {
        XERO_CLIENT_ID: "cid",
        XERO_CLIENT_SECRET: "secret",
        XERO_REDIRECT_URI: "http://localhost:3000/v1/connections/xero/callback",
      };
      return v[k];
    }),
  };

  beforeEach(() => {
    mockBuildConsentUrl.mockReset();
    mockApiCallback.mockReset();
    mockUpdateTenants.mockReset();
    mockInitialize.mockClear();
    mockSetTokenSet.mockReset();
    (XeroClient as unknown as jest.Mock).mockClear();
    provider = new XeroOAuthProvider(config as never);
  });

  describe("buildAuthUrl", () => {
    it("initializes XeroClient with state and returns consent URL", async () => {
      mockBuildConsentUrl.mockResolvedValue(
        "https://login.xero.com/authorize?state=s",
      );
      const url = await provider.buildAuthUrl("s");
      expect(url).toEqual("https://login.xero.com/authorize?state=s");
      expect(XeroClient).toHaveBeenCalledWith(
        expect.objectContaining({ state: "s" }),
      );
      expect(mockInitialize).toHaveBeenCalled();
    });

    it("requests the correct scopes", async () => {
      mockBuildConsentUrl.mockResolvedValue("u");
      await provider.buildAuthUrl("s");
      const ctorArg = (XeroClient as unknown as jest.Mock).mock.calls[0][0];
      expect(ctorArg.scopes).toEqual([
        "openid",
        "profile",
        "email",
        "accounting.invoices",
        "accounting.contacts",
        "offline_access",
      ]);
    });
  });

  describe("exchangeCode", () => {
    it("returns normalized tokens from apiCallback", async () => {
      mockApiCallback.mockResolvedValue({
        access_token: "at",
        refresh_token: "rt",
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      });

      const tokens = await provider.exchangeCode("c", "s", {});

      expect(mockApiCallback).toHaveBeenCalledWith(
        "http://localhost:3000/v1/connections/xero/callback?code=c&state=s",
      );
      expect(tokens.accessToken).toEqual("at");
      expect(tokens.refreshToken).toEqual("rt");
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("resolveTenantId", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("returns first tenant and does not warn when length === 1", async () => {
      mockUpdateTenants.mockImplementation(async function (this: {
        tenants: Array<{ tenantId: string; tenantName: string }>;
      }) {
        this.tenants = [{ tenantId: "t-1", tenantName: "Org A" }];
        return this.tenants;
      });

      const id = await provider.resolveTenantId(
        {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: new Date(Date.now() + 1_000_000),
        },
        {},
      );

      expect(id).toEqual("t-1");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("returns first tenant and warns when length > 1", async () => {
      mockUpdateTenants.mockImplementation(async function (this: {
        tenants: Array<{ tenantId: string; tenantName: string }>;
      }) {
        this.tenants = [
          { tenantId: "t-1", tenantName: "Org A" },
          { tenantId: "t-2", tenantName: "Org B" },
        ];
        return this.tenants;
      });

      const id = await provider.resolveTenantId(
        { accessToken: "at", refreshToken: "rt", expiresAt: new Date() },
        {},
      );

      expect(id).toEqual("t-1");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Xero connection returned multiple tenants",
          tenantCount: 2,
        }),
      );
    });

    it("throws when tenants list is empty", async () => {
      mockUpdateTenants.mockImplementation(async function (this: {
        tenants: unknown[];
      }) {
        this.tenants = [];
        return this.tenants;
      });
      await expect(
        provider.resolveTenantId(
          { accessToken: "at", refreshToken: "rt", expiresAt: new Date() },
          {},
        ),
      ).rejects.toThrow(/no tenants/i);
    });
  });
});
