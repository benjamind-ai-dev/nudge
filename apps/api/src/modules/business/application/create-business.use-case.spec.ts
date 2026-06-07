import { CreateBusinessUseCase } from "./create-business.use-case";
import {
  BusinessLimitReachedError,
  AccountNotFoundError,
} from "../domain/business.errors";
import type { BusinessRepository, BusinessWithConnections, CreateBusinessData } from "../domain/business.repository";
import type { AccountReader, AccountSummary } from "../domain/account-reader";
import type { CreateDefaultTemplateUseCase } from "../../templates/application/create-default-template.use-case";

const baseData: CreateBusinessData = {
  accountId: "acc-1",
  name: "Acme",
  accountingProvider: "quickbooks",
  senderName: "Jane",
  senderEmail: "jane@acme.com",
  timezone: "America/Los_Angeles",
};

const builtBusiness = { id: "biz-1", senderEmail: "jane@acme.com" } as BusinessWithConnections;

function makeUseCase(opts: {
  count?: number;
  account?: AccountSummary | null;
  onCreate?: (d: CreateBusinessData) => void;
}) {
  const repo: BusinessRepository = {
    findById: jest.fn(),
    create: jest.fn(async (d: CreateBusinessData) => {
      opts.onCreate?.(d);
      return { ...builtBusiness, senderEmail: d.senderEmail ?? "" } as BusinessWithConnections;
    }),
    updateSettings: jest.fn(),
    softDelete: jest.fn(),
    countByAccountId: jest.fn(async () => opts.count ?? 0),
  };
  const accounts: AccountReader = {
    findById: jest.fn(async () =>
      opts.account === undefined
        ? { id: "acc-1", email: "owner@acme.com", maxBusinesses: 1 }
        : opts.account,
    ),
  };
  const defaultTemplate = { execute: jest.fn(async () => undefined) } as unknown as CreateDefaultTemplateUseCase;
  return { useCase: new CreateBusinessUseCase(repo, accounts, defaultTemplate), repo, accounts };
}

describe("CreateBusinessUseCase", () => {
  it("creates a business when under the limit", async () => {
    const { useCase } = makeUseCase({ count: 0 });
    const result = await useCase.execute(baseData);
    expect(result.id).toBe("biz-1");
  });

  it("throws BusinessLimitReachedError when at the limit", async () => {
    const { useCase, repo } = makeUseCase({ count: 1 }); // maxBusinesses 1
    await expect(useCase.execute(baseData)).rejects.toBeInstanceOf(BusinessLimitReachedError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("throws AccountNotFoundError when account is missing", async () => {
    const { useCase } = makeUseCase({ account: null });
    await expect(useCase.execute(baseData)).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it("defaults senderEmail to the account email when omitted", async () => {
    let received: CreateBusinessData | undefined;
    const { useCase } = makeUseCase({ count: 0, onCreate: (d) => (received = d) });
    await useCase.execute({ ...baseData, senderEmail: undefined });
    expect(received?.senderEmail).toBe("owner@acme.com");
  });
});
