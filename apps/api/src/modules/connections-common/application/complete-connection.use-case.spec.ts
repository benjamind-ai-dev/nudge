import { Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  CompleteConnectionUseCase,
  CompleteConnectionInput,
} from "./complete-connection.use-case";
import { type OAuthProvider, Connection } from "@nudge/connections-domain";

const KEY = "a".repeat(64);
const SUCCESS = "http://localhost:5173/onboarding/complete?status=success";
const ERR = (reason: string) =>
  `http://localhost:5173/onboarding/complete?status=error&reason=${reason}`;

describe("CompleteConnectionUseCase", () => {
  let stateService: { consume: jest.Mock };
  let connectionRepo: { upsertByBusinessAndProvider: jest.Mock };
  let invoiceSyncQueue: jest.Mocked<Queue>;
  let config: { get: jest.Mock };
  let xeroProvider: jest.Mocked<OAuthProvider>;
  let qbProvider: jest.Mocked<OAuthProvider>;
  let useCase: CompleteConnectionUseCase;

  beforeEach(() => {
    stateService = { consume: jest.fn() };
    connectionRepo = {
      upsertByBusinessAndProvider: jest
        .fn()
        .mockImplementation(async (c: Connection) => {
          // Simulate database assign of a persisted id
          Object.defineProperty(c, "id", { value: "saved-conn-id", writable: false, configurable: true });
          return c;
        }),
    };
    invoiceSyncQueue = { add: jest.fn().mockResolvedValue({}) } as unknown as jest.Mocked<Queue>;
    config = {
      get: jest.fn((k: string) => {
        if (k === "FRONTEND_URL") return "http://localhost:5173";
        if (k === "ENCRYPTION_KEY") return KEY;
        return undefined;
      }),
    };
    xeroProvider = {
      name: "xero",
      scopes: "openid",
      buildAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      resolveTenantId: jest.fn(),
    } as unknown as jest.Mocked<OAuthProvider>;
    qbProvider = {
      name: "quickbooks",
      scopes: "qb",
      buildAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      resolveTenantId: jest.fn(),
    } as unknown as jest.Mocked<OAuthProvider>;
    useCase = new CompleteConnectionUseCase(
      stateService as never,
      connectionRepo as never,
      invoiceSyncQueue,
      config as never,
      { quickbooks: qbProvider, xero: xeroProvider },
    );
  });

  const goodTokens = {
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: new Date("2030-01-01"),
  };

  const baseInput = (p: Partial<CompleteConnectionInput> = {}): CompleteConnectionInput => ({
    code: "c",
    state: "s",
    providerHint: "xero",
    providerMetadata: {},
    ...p,
  });

  it("returns invalid_state when state is missing", async () => {
    stateService.consume.mockResolvedValue(null);
    const { redirectUrl } = await useCase.execute(baseInput());
    expect(redirectUrl).toEqual(ERR("invalid_state"));
  });

  it("returns invalid_state when state provider mismatches callback provider", async () => {
    stateService.consume.mockResolvedValue({
      businessId: "b",
      provider: "quickbooks",
    });
    const { redirectUrl } = await useCase.execute(baseInput({ providerHint: "xero" }));
    expect(redirectUrl).toEqual(ERR("invalid_state"));
  });

  it("returns token_exchange_failed when provider.exchangeCode throws", async () => {
    stateService.consume.mockResolvedValue({ businessId: "b", provider: "xero" });
    xeroProvider.exchangeCode.mockRejectedValue(new Error("bad code"));
    const { redirectUrl } = await useCase.execute(baseInput());
    expect(redirectUrl).toEqual(ERR("token_exchange_failed"));
    expect(connectionRepo.upsertByBusinessAndProvider).not.toHaveBeenCalled();
  });

  it("returns tenant_fetch_failed when provider.resolveTenantId throws", async () => {
    stateService.consume.mockResolvedValue({ businessId: "b", provider: "xero" });
    xeroProvider.exchangeCode.mockResolvedValue(goodTokens);
    xeroProvider.resolveTenantId.mockRejectedValue(new Error("no tenants"));
    const { redirectUrl } = await useCase.execute(baseInput());
    expect(redirectUrl).toEqual(ERR("tenant_fetch_failed"));
  });

  it("persists Connection, enqueues invoice-sync, returns success (Xero)", async () => {
    stateService.consume.mockResolvedValue({ businessId: "b", provider: "xero" });
    xeroProvider.exchangeCode.mockResolvedValue(goodTokens);
    xeroProvider.resolveTenantId.mockResolvedValue("tenant-1");

    const { redirectUrl } = await useCase.execute(baseInput());

    expect(redirectUrl).toEqual(SUCCESS);
    expect(connectionRepo.upsertByBusinessAndProvider).toHaveBeenCalledTimes(1);
    const conn: Connection =
      connectionRepo.upsertByBusinessAndProvider.mock.calls[0][0];
    expect(conn.businessId).toEqual("b");
    expect(conn.provider).toEqual("xero");
    expect(conn.externalTenantId).toEqual("tenant-1");
    expect(conn.accessToken).toEqual("at");
    expect(conn.refreshToken).toEqual("rt");
    expect(invoiceSyncQueue.add).toHaveBeenCalledWith("invoice-sync", {
      connectionId: "saved-conn-id",
    });
  });

  it("passes providerMetadata through to exchangeCode and resolveTenantId (QB)", async () => {
    stateService.consume.mockResolvedValue({
      businessId: "b",
      provider: "quickbooks",
    });
    qbProvider.exchangeCode.mockResolvedValue(goodTokens);
    qbProvider.resolveTenantId.mockResolvedValue("realm-1");

    await useCase.execute(
      baseInput({
        providerHint: "quickbooks",
        providerMetadata: { realmId: "realm-1" },
      }),
    );

    expect(qbProvider.exchangeCode).toHaveBeenCalledWith("c", "s", {
      realmId: "realm-1",
    });
    expect(qbProvider.resolveTenantId).toHaveBeenCalledWith(goodTokens, {
      realmId: "realm-1",
    });
  });

  it("returns internal_error for any other thrown error during persistence", async () => {
    stateService.consume.mockResolvedValue({ businessId: "b", provider: "xero" });
    xeroProvider.exchangeCode.mockResolvedValue(goodTokens);
    xeroProvider.resolveTenantId.mockResolvedValue("tenant-1");
    connectionRepo.upsertByBusinessAndProvider.mockRejectedValue(
      new Error("db down"),
    );
    const { redirectUrl } = await useCase.execute(baseInput());
    expect(redirectUrl).toEqual(ERR("internal_error"));
  });

  it("never writes code, state, or raw tokens to any log", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const errSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();

    const SECRET_CODE = "CODE-ZZ-0001";
    const SECRET_STATE = "STATE-ZZ-0002";
    const SECRET_ACCESS = "ACCESS-ZZ-0003";
    const SECRET_REFRESH = "REFRESH-ZZ-0004";

    stateService.consume.mockResolvedValue({ businessId: "b", provider: "xero" });
    xeroProvider.exchangeCode.mockResolvedValue({
      accessToken: SECRET_ACCESS,
      refreshToken: SECRET_REFRESH,
      expiresAt: new Date("2030-01-01"),
    });
    xeroProvider.resolveTenantId.mockResolvedValue("tenant-1");

    await useCase.execute(
      baseInput({ code: SECRET_CODE, state: SECRET_STATE }),
    );

    const allLogs = [
      ...logSpy.mock.calls.map((c) => JSON.stringify(c)),
      ...warnSpy.mock.calls.map((c) => JSON.stringify(c)),
      ...errSpy.mock.calls.map((c) => JSON.stringify(c)),
    ].join("\n");

    expect(allLogs).not.toContain(SECRET_CODE);
    expect(allLogs).not.toContain(SECRET_STATE);
    expect(allLogs).not.toContain(SECRET_ACCESS);
    expect(allLogs).not.toContain(SECRET_REFRESH);

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
