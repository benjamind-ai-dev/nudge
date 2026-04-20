import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { UnrecoverableError } from "bullmq";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
  OAUTH_PROVIDERS,
  OAuthProvider,
  OAuthProviderMap,
  RefreshFailedError,
  RefreshTokenExpiredError,
  TokenRevokedError,
} from "@nudge/connections-domain";
import { RefreshTokenUseCase } from "./refresh-token.use-case";

const KEY = "a".repeat(64);
const CONNECTION_ID = "conn-1";

function makeRepo(): jest.Mocked<ConnectionRepository> {
  return {
    upsertByBusinessAndProvider: jest.fn(),
    findByBusinessAndProvider: jest.fn(),
    findById: jest.fn(),
    findDueForRefresh: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    refreshConnection: jest.fn(),
  } as unknown as jest.Mocked<ConnectionRepository>;
}

function makeProvider(name: "quickbooks" | "xero" = "quickbooks"): jest.Mocked<OAuthProvider> {
  return {
    name,
    scopes: "s",
    buildAuthUrl: jest.fn(),
    exchangeCode: jest.fn(),
    resolveTenantId: jest.fn(),
    refreshTokens: jest.fn(),
  } as unknown as jest.Mocked<OAuthProvider>;
}

async function build(repo: ConnectionRepository, providers: OAuthProviderMap) {
  const module = await Test.createTestingModule({
    providers: [
      RefreshTokenUseCase,
      { provide: CONNECTION_REPOSITORY, useValue: repo },
      { provide: OAUTH_PROVIDERS, useValue: providers },
      { provide: ConfigService, useValue: { get: () => KEY } },
    ],
  }).compile();
  return module.get(RefreshTokenUseCase);
}

describe("RefreshTokenUseCase", () => {
  it("logs success and returns on refreshed outcome", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks", id: CONNECTION_ID } as any);
    repo.refreshConnection.mockResolvedValue({
      kind: "refreshed",
      connection: {
        id: CONNECTION_ID,
        businessId: "b-1",
        provider: "quickbooks",
        tokenExpiresAt: new Date("2031-01-01"),
      } as any,
    });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).resolves.toBeUndefined();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns silently when skipped=lock_held", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks" } as any);
    repo.refreshConnection.mockResolvedValue({ kind: "skipped", reason: "lock_held" });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).resolves.toBeUndefined();
  });

  it("returns silently when skipped=status_changed", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks" } as any);
    repo.refreshConnection.mockResolvedValue({ kind: "skipped", reason: "status_changed" });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).resolves.toBeUndefined();
  });

  it("returns silently when connection not found", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).resolves.toBeUndefined();
    expect(repo.refreshConnection).not.toHaveBeenCalled();
  });

  it("treats TokenRevokedError as ack-replay when lastRefreshAt is within 60s", async () => {
    const repo = makeRepo();
    repo.findById
      .mockResolvedValueOnce({ provider: "quickbooks" } as any) // first lookup before refreshConnection
      .mockResolvedValueOnce({ lastRefreshAt: new Date(Date.now() - 30_000) } as any); // after error
    repo.refreshConnection.mockResolvedValue({
      kind: "failed",
      error: new TokenRevokedError(),
    });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).resolves.toBeUndefined();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("marks revoked and throws UnrecoverableError when TokenRevokedError and lastRefreshAt is stale", async () => {
    const repo = makeRepo();
    repo.findById
      .mockResolvedValueOnce({ provider: "quickbooks" } as any)
      .mockResolvedValueOnce({ lastRefreshAt: new Date(Date.now() - 10 * 60_000) } as any);
    repo.refreshConnection.mockResolvedValue({
      kind: "failed",
      error: new TokenRevokedError(),
    });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repo.updateStatus).toHaveBeenCalledWith(
      CONNECTION_ID,
      "revoked",
      expect.any(String),
    );
  });

  it("marks revoked and throws UnrecoverableError when findById returns null on re-read", async () => {
    const repo = makeRepo();
    repo.findById
      .mockResolvedValueOnce({ provider: "quickbooks" } as any)
      .mockResolvedValueOnce(null);
    repo.refreshConnection.mockResolvedValue({
      kind: "failed",
      error: new TokenRevokedError(),
    });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repo.updateStatus).toHaveBeenCalledWith(CONNECTION_ID, "revoked", expect.any(String));
  });

  it("marks expired and throws UnrecoverableError on RefreshTokenExpiredError", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks" } as any);
    repo.refreshConnection.mockResolvedValue({
      kind: "failed",
      error: new RefreshTokenExpiredError(),
    });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repo.updateStatus).toHaveBeenCalledWith(CONNECTION_ID, "expired", expect.any(String));
  });

  it("rethrows RefreshFailedError for BullMQ to retry", async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks" } as any);
    const err = new RefreshFailedError(new Error("ECONNREFUSED"));
    repo.refreshConnection.mockResolvedValue({ kind: "failed", error: err });

    const useCase = await build(repo, { quickbooks: makeProvider(), xero: makeProvider("xero") });
    await expect(useCase.execute(CONNECTION_ID)).rejects.toBe(err);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("routes to the correct provider for QuickBooks connections", async () => {
    const qb = makeProvider("quickbooks");
    const xero = makeProvider("xero");
    qb.refreshTokens.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: new Date(),
    });
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ provider: "quickbooks" } as any);
    repo.refreshConnection.mockImplementation(async (_id, refreshOp) => {
      await refreshOp("the-refresh-token");
      return { kind: "refreshed", connection: { provider: "quickbooks" } as any };
    });

    const useCase = await build(repo, { quickbooks: qb, xero });
    await useCase.execute(CONNECTION_ID);
    expect(qb.refreshTokens).toHaveBeenCalledWith("the-refresh-token");
    expect(xero.refreshTokens).not.toHaveBeenCalled();
  });
});
