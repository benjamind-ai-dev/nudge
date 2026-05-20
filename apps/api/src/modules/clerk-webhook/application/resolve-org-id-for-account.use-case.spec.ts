import { ResolveOrgIdForAccountUseCase } from "./resolve-org-id-for-account.use-case";
import { AccountProvisionRepository } from "../domain/account-provision.repository";
import { ClerkOrganizationService } from "../../users/domain/clerk-organization.service";

const makeRepo = (overrides: Partial<AccountProvisionRepository> = {}): AccountProvisionRepository => ({
  findByClerkId: jest.fn(),
  create: jest.fn(),
  findAccountForOrgResolution: jest.fn(),
  setClerkOrganizationId: jest.fn(),
  ...overrides,
});

const makeOrgs = (overrides: Partial<ClerkOrganizationService> = {}): ClerkOrganizationService => ({
  createOrganization: jest.fn().mockResolvedValue({ clerkOrganizationId: "org_new" }),
  createOrganizationInvitation: jest.fn(),
  revokeOrganizationInvitation: jest.fn(),
  deleteOrganizationMembership: jest.fn(),
  createOrganizationMembership: jest.fn(),
  ...overrides,
});

describe("ResolveOrgIdForAccountUseCase", () => {
  it("returns the existing clerkOrganizationId when already set", async () => {
    const repo = makeRepo({
      findAccountForOrgResolution: jest.fn().mockResolvedValue({
        accountId: "acc_1",
        accountName: "Acme",
        clerkOrganizationId: "org_existing",
        ownerClerkUserId: "user_owner",
      }),
    });
    const orgs = makeOrgs();
    const useCase = new ResolveOrgIdForAccountUseCase(repo, orgs);

    const result = await useCase.execute("acc_1");

    expect(result).toBe("org_existing");
    expect(orgs.createOrganization).not.toHaveBeenCalled();
  });

  it("creates a Clerk Org and persists the id when none exists yet", async () => {
    const repo = makeRepo({
      findAccountForOrgResolution: jest.fn().mockResolvedValue({
        accountId: "acc_1",
        accountName: "Acme",
        clerkOrganizationId: null,
        ownerClerkUserId: "user_owner",
      }),
    });
    const orgs = makeOrgs();
    const useCase = new ResolveOrgIdForAccountUseCase(repo, orgs);

    const result = await useCase.execute("acc_1");

    expect(orgs.createOrganization).toHaveBeenCalledWith({
      name: "Acme",
      ownerClerkUserId: "user_owner",
    });
    expect(repo.setClerkOrganizationId).toHaveBeenCalledWith("acc_1", "org_new");
    expect(result).toBe("org_new");
  });

  it("throws when account does not exist", async () => {
    const repo = makeRepo({
      findAccountForOrgResolution: jest.fn().mockResolvedValue(null),
    });
    const useCase = new ResolveOrgIdForAccountUseCase(repo, makeOrgs());
    await expect(useCase.execute("acc_missing")).rejects.toThrow(/account not found/i);
  });

  it("throws when account has no owner clerkUserId yet (cannot lazy-create org)", async () => {
    const repo = makeRepo({
      findAccountForOrgResolution: jest.fn().mockResolvedValue({
        accountId: "acc_1",
        accountName: "Acme",
        clerkOrganizationId: null,
        ownerClerkUserId: null,
      }),
    });
    const useCase = new ResolveOrgIdForAccountUseCase(repo, makeOrgs());
    await expect(useCase.execute("acc_1")).rejects.toThrow(/owner clerk user id/i);
  });
});
