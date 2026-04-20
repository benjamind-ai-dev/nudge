import {
  StartConnectionUseCase,
  StartConnectionInput,
} from "./start-connection.use-case";
import { BusinessNotFoundError } from "../domain/connection.errors";
import { type OAuthProvider } from "@nudge/connections-domain";

describe("StartConnectionUseCase", () => {
  const businessId = "b-1";
  let businessRepo: { findById: jest.Mock };
  let stateService: { create: jest.Mock };
  let xeroProvider: jest.Mocked<OAuthProvider>;
  let qbProvider: jest.Mocked<OAuthProvider>;
  let useCase: StartConnectionUseCase;

  beforeEach(() => {
    businessRepo = { findById: jest.fn() };
    stateService = { create: jest.fn() };
    xeroProvider = {
      name: "xero",
      scopes: "openid profile",
      buildAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      resolveTenantId: jest.fn(),
    } as unknown as jest.Mocked<OAuthProvider>;
    qbProvider = {
      name: "quickbooks",
      scopes: "com.intuit.quickbooks.accounting",
      buildAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      resolveTenantId: jest.fn(),
    } as unknown as jest.Mocked<OAuthProvider>;
    useCase = new StartConnectionUseCase(
      businessRepo as never,
      stateService as never,
      { quickbooks: qbProvider, xero: xeroProvider },
    );
  });

  const input = (
    p: Partial<StartConnectionInput> = {},
  ): StartConnectionInput => ({
    businessId,
    provider: "xero",
    ...p,
  });

  it("throws BusinessNotFoundError when business does not exist", async () => {
    businessRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input())).rejects.toThrow(
      BusinessNotFoundError,
    );
  });

  it("creates state bound to { businessId, provider } and returns provider auth URL", async () => {
    businessRepo.findById.mockResolvedValue({ id: businessId });
    stateService.create.mockResolvedValue("state-token");
    xeroProvider.buildAuthUrl.mockResolvedValue(
      "https://login.xero.com/authorize?state=state-token",
    );

    const result = await useCase.execute(input());

    expect(stateService.create).toHaveBeenCalledWith({
      businessId,
      provider: "xero",
    });
    expect(xeroProvider.buildAuthUrl).toHaveBeenCalledWith("state-token");
    expect(result).toEqual({
      oauthUrl: "https://login.xero.com/authorize?state=state-token",
    });
  });

  it("routes to the QuickBooks provider when provider is quickbooks", async () => {
    businessRepo.findById.mockResolvedValue({ id: businessId });
    stateService.create.mockResolvedValue("s");
    qbProvider.buildAuthUrl.mockResolvedValue(
      "https://appcenter.intuit.com/?state=s",
    );

    await useCase.execute(input({ provider: "quickbooks" }));

    expect(qbProvider.buildAuthUrl).toHaveBeenCalledWith("s");
    expect(xeroProvider.buildAuthUrl).not.toHaveBeenCalled();
  });
});
