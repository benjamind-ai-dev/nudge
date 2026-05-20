import { Test } from "@nestjs/testing";
import { DeleteBusinessUseCase } from "./delete-business.use-case";
import { BusinessNotFoundError } from "../domain/business.errors";
import { BUSINESS_REPOSITORY } from "../domain/business.repository";
import { DISCONNECT_REPOSITORY } from "../domain/disconnect.repository";
import { OAUTH_PROVIDERS } from "@nudge/connections-domain";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("DeleteBusinessUseCase", () => {
  let useCase: DeleteBusinessUseCase;
  const businessRepo = { findById: jest.fn() };
  const disconnect = {
    findActiveConnections: jest.fn(),
    runDisconnect: jest.fn(),
  };
  const qbProvider = { name: "quickbooks", revokeTokens: jest.fn() };
  const xeroProvider = { name: "xero", revokeTokens: jest.fn() };
  const providers = { quickbooks: qbProvider, xero: xeroProvider };

  beforeEach(async () => {
    businessRepo.findById.mockReset();
    disconnect.findActiveConnections.mockReset();
    disconnect.runDisconnect.mockReset();
    qbProvider.revokeTokens.mockReset();
    xeroProvider.revokeTokens.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        DeleteBusinessUseCase,
        { provide: BUSINESS_REPOSITORY, useValue: businessRepo },
        { provide: DISCONNECT_REPOSITORY, useValue: disconnect },
        { provide: OAUTH_PROVIDERS, useValue: providers },
      ],
    }).compile();
    useCase = module.get(DeleteBusinessUseCase);
  });

  it("(a) QuickBooks happy path — revokes, stops runs, deactivates", async () => {
    businessRepo.findById.mockResolvedValue({ id: BIZ_ID });
    disconnect.findActiveConnections.mockResolvedValue([
      { id: "c1", provider: "quickbooks", refreshToken: "rt-qb" },
    ]);
    qbProvider.revokeTokens.mockResolvedValue(undefined);
    disconnect.runDisconnect.mockResolvedValue({
      stoppedRunCount: 2, revokedConnectionCount: 1,
    });

    await useCase.execute(BIZ_ID);

    expect(qbProvider.revokeTokens).toHaveBeenCalledWith("rt-qb");
    expect(xeroProvider.revokeTokens).not.toHaveBeenCalled();
    expect(disconnect.runDisconnect).toHaveBeenCalledWith(BIZ_ID);
  });

  it("(b) Xero happy path", async () => {
    businessRepo.findById.mockResolvedValue({ id: BIZ_ID });
    disconnect.findActiveConnections.mockResolvedValue([
      { id: "c2", provider: "xero", refreshToken: "rt-xero" },
    ]);
    xeroProvider.revokeTokens.mockResolvedValue(undefined);
    disconnect.runDisconnect.mockResolvedValue({
      stoppedRunCount: 0, revokedConnectionCount: 1,
    });

    await useCase.execute(BIZ_ID);

    expect(xeroProvider.revokeTokens).toHaveBeenCalledWith("rt-xero");
    expect(qbProvider.revokeTokens).not.toHaveBeenCalled();
    expect(disconnect.runDisconnect).toHaveBeenCalledWith(BIZ_ID);
  });

  it("(c) provider revoke failure does NOT block the disconnect", async () => {
    businessRepo.findById.mockResolvedValue({ id: BIZ_ID });
    disconnect.findActiveConnections.mockResolvedValue([
      { id: "c1", provider: "quickbooks", refreshToken: "rt-qb" },
    ]);
    qbProvider.revokeTokens.mockRejectedValue(new Error("upstream 500"));
    disconnect.runDisconnect.mockResolvedValue({
      stoppedRunCount: 0, revokedConnectionCount: 1,
    });

    await expect(useCase.execute(BIZ_ID)).resolves.toBeUndefined();
    expect(disconnect.runDisconnect).toHaveBeenCalledWith(BIZ_ID);
  });

  it("(d) no connections — skips revoke loop and still disconnects", async () => {
    businessRepo.findById.mockResolvedValue({ id: BIZ_ID });
    disconnect.findActiveConnections.mockResolvedValue([]);
    disconnect.runDisconnect.mockResolvedValue({
      stoppedRunCount: 3, revokedConnectionCount: 0,
    });

    await useCase.execute(BIZ_ID);

    expect(qbProvider.revokeTokens).not.toHaveBeenCalled();
    expect(xeroProvider.revokeTokens).not.toHaveBeenCalled();
    expect(disconnect.runDisconnect).toHaveBeenCalledWith(BIZ_ID);
  });

  it("(e) no active runs — still revokes provider and deactivates", async () => {
    businessRepo.findById.mockResolvedValue({ id: BIZ_ID });
    disconnect.findActiveConnections.mockResolvedValue([
      { id: "c1", provider: "quickbooks", refreshToken: "rt-qb" },
    ]);
    qbProvider.revokeTokens.mockResolvedValue(undefined);
    disconnect.runDisconnect.mockResolvedValue({
      stoppedRunCount: 0, revokedConnectionCount: 1,
    });

    await useCase.execute(BIZ_ID);

    expect(qbProvider.revokeTokens).toHaveBeenCalled();
    expect(disconnect.runDisconnect).toHaveBeenCalled();
  });

  it("(f) throws BusinessNotFoundError when business missing", async () => {
    businessRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(BIZ_ID)).rejects.toThrow(BusinessNotFoundError);
    expect(disconnect.findActiveConnections).not.toHaveBeenCalled();
    expect(disconnect.runDisconnect).not.toHaveBeenCalled();
  });
});
