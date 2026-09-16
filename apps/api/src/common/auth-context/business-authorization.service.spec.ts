import { BusinessAuthorizationService } from "./business-authorization.service";
import {
  AccountNotEntitledError,
  CallerNotProvisionedError,
} from "./business-authorization.errors";
import { BusinessNotFoundError } from "../../modules/business/domain/business.errors";
import type { CallerContextService } from "./caller-context.service";
import type {
  BusinessOwnership,
  BusinessOwnershipRepository,
} from "./business-ownership.repository";

const CLERK_ID = "user_clerk_123";
const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const BUSINESS_ID = "550e8400-e29b-41d4-a716-446655440010";
const OWNER = { userId: "u1", accountId: ACCOUNT_ID, role: "owner" as const };

function makeService(opts: {
  caller?: { userId: string; accountId: string; role: "owner" | "admin" | "viewer" } | null;
  ownership?: BusinessOwnership | null;
}) {
  const callerCtx = {
    resolve: jest.fn().mockResolvedValue(opts.caller ?? null),
  } as unknown as CallerContextService;
  const repo: BusinessOwnershipRepository = {
    findForAccount: jest.fn().mockResolvedValue(opts.ownership ?? null),
  };
  const service = new BusinessAuthorizationService(callerCtx, repo);
  return { service, callerCtx, repo };
}

describe("BusinessAuthorizationService", () => {
  it("resolves void when caller owns a live business on a paid account", async () => {
    const { service, repo } = makeService({
      caller: OWNER,
      ownership: { isActive: true, accountStatus: "active" },
    });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).resolves.toBeUndefined();

    expect(repo.findForAccount).toHaveBeenCalledWith(BUSINESS_ID, ACCOUNT_ID);
  });

  it("throws CallerNotProvisionedError when the clerk user has no users row", async () => {
    const { service } = makeService({ caller: null });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(CallerNotProvisionedError);
  });

  it("throws BusinessNotFoundError when the business does not exist or is foreign", async () => {
    // findForAccount returns null for cross-account too — same code on purpose
    const { service } = makeService({ caller: OWNER, ownership: null });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(BusinessNotFoundError);
  });

  it("throws BusinessNotFoundError when the business is soft-deleted", async () => {
    const { service } = makeService({
      caller: OWNER,
      ownership: { isActive: false, accountStatus: "active" },
    });

    await expect(
      service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID),
    ).rejects.toBeInstanceOf(BusinessNotFoundError);
  });

  it.each(["trial", "past_due", "canceled", "incomplete"])(
    "throws AccountNotEntitledError (402) when account status is %s",
    async (status) => {
      const { service } = makeService({
        caller: OWNER,
        ownership: { isActive: true, accountStatus: status },
      });

      const promise = service.assertCallerOwnsBusiness(CLERK_ID, BUSINESS_ID);
      await expect(promise).rejects.toBeInstanceOf(AccountNotEntitledError);
      await expect(promise).rejects.toMatchObject({ httpStatus: 402 });
    },
  );
});
