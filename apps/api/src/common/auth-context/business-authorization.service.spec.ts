import { BusinessAuthorizationService } from "./business-authorization.service";
import { CallerNotProvisionedError } from "./business-authorization.errors";
import { BusinessNotFoundError } from "../../modules/business/domain/business.errors";
import type { CallerContextService } from "./caller-context.service";
import type { BusinessOwnershipRepository } from "./business-ownership.repository";

const CLERK_ID = "user_clerk_123";
const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const BUSINESS_ID = "550e8400-e29b-41d4-a716-446655440010";

function makeService(opts: {
  caller?: { userId: string; accountId: string; role: "owner" | "admin" | "viewer" } | null;
  exists?: boolean;
}) {
  const callerCtx = {
    resolve: jest.fn().mockResolvedValue(opts.caller ?? null),
  } as unknown as CallerContextService;
  const repo: BusinessOwnershipRepository = {
    existsForAccount: jest.fn().mockResolvedValue(opts.exists ?? false),
  };
  const service = new BusinessAuthorizationService(callerCtx, repo);
  return { service, callerCtx, repo };
}

describe("BusinessAuthorizationService", () => {
  it("resolves void when caller's account owns the business", async () => {
    const { service, repo } = makeService({
      caller: { userId: "u1", accountId: ACCOUNT_ID, role: "owner" },
      exists: true,
    });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).resolves.toBeUndefined();

    expect(repo.existsForAccount).toHaveBeenCalledWith(BUSINESS_ID, ACCOUNT_ID);
  });

  it("throws CallerNotProvisionedError when the clerk user has no users row", async () => {
    const { service } = makeService({ caller: null });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(CallerNotProvisionedError);
  });

  it("throws BusinessNotFoundError when the business does not exist", async () => {
    const { service } = makeService({
      caller: { userId: "u1", accountId: ACCOUNT_ID, role: "owner" },
      exists: false,
    });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(BusinessNotFoundError);
  });

  it("throws BusinessNotFoundError when the business belongs to a different account", async () => {
    // existsForAccount returns false for cross-account too — same code on purpose
    const { service } = makeService({
      caller: { userId: "u1", accountId: ACCOUNT_ID, role: "admin" },
      exists: false,
    });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(BusinessNotFoundError);
  });
});
