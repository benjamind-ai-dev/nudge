import { BackfillClerkOrgsUseCase } from "./backfill-clerk-orgs.use-case";
import type { DevAccountListingRepository } from "../domain/dev-account-listing.repository";
import type { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";

const mkAccounts = (
  over: Partial<DevAccountListingRepository> = {},
): DevAccountListingRepository => ({
  listAccountsMissingClerkOrg: jest.fn().mockResolvedValue([]),
  ...over,
});

const mkResolveOrg = (
  over: Partial<ResolveOrgIdForAccountUseCase> = {},
): ResolveOrgIdForAccountUseCase =>
  ({
    execute: jest.fn(),
    ...over,
  }) as unknown as ResolveOrgIdForAccountUseCase;

describe("BackfillClerkOrgsUseCase", () => {
  it("returns zeros when no accounts need backfill", async () => {
    const accounts = mkAccounts();
    const resolveOrg = mkResolveOrg();
    const useCase = new BackfillClerkOrgsUseCase(accounts, resolveOrg);

    const result = await useCase.execute();

    expect(result).toEqual({
      scanned: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    });
    expect(resolveOrg.execute).not.toHaveBeenCalled();
  });

  it("calls ResolveOrgIdForAccountUseCase once per account and counts successes", async () => {
    const accounts = mkAccounts({
      listAccountsMissingClerkOrg: jest
        .fn()
        .mockResolvedValue(["acc-1", "acc-2", "acc-3"]),
    });
    const resolveOrg = mkResolveOrg({
      execute: jest.fn().mockResolvedValue("org_x"),
    });
    const useCase = new BackfillClerkOrgsUseCase(accounts, resolveOrg);

    const result = await useCase.execute();

    expect(result.scanned).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(resolveOrg.execute).toHaveBeenCalledTimes(3);
  });

  it("counts 'owner clerk user id is not set' as skipped (cannot backfill, not a failure)", async () => {
    const accounts = mkAccounts({
      listAccountsMissingClerkOrg: jest
        .fn()
        .mockResolvedValue(["legacy-acc"]),
    });
    const resolveOrg = mkResolveOrg({
      execute: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Cannot lazy-create Clerk Org for account legacy-acc: owner clerk user id is not set",
          ),
        ),
    });
    const useCase = new BackfillClerkOrgsUseCase(accounts, resolveOrg);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it("counts other errors as failed and records the account id + message", async () => {
    const accounts = mkAccounts({
      listAccountsMissingClerkOrg: jest
        .fn()
        .mockResolvedValue(["good-1", "bad-1", "good-2"]),
    });
    const execute = jest
      .fn()
      .mockResolvedValueOnce("org_g1")
      .mockRejectedValueOnce(new Error("Clerk: rate limit"))
      .mockResolvedValueOnce("org_g2");
    const resolveOrg = mkResolveOrg({ execute });
    const useCase = new BackfillClerkOrgsUseCase(accounts, resolveOrg);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      { accountId: "bad-1", error: "Clerk: rate limit" },
    ]);
  });
});
