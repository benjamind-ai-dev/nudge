import { ProvisionAccountUseCase } from "./provision-account.use-case";
import { AccountProvisionRepository } from "../domain/account-provision.repository";
import { ClerkOrganizationService } from "../../users/domain/clerk-organization.service";

const makeRepo = (overrides: Partial<AccountProvisionRepository> = {}): AccountProvisionRepository => ({
  findByClerkId: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(undefined),
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

describe("ProvisionAccountUseCase", () => {
  it("creates a Clerk Org and persists the id on the new account", async () => {
    const repo = makeRepo();
    const orgs = makeOrgs();
    const useCase = new ProvisionAccountUseCase(repo, orgs);

    await useCase.execute("user_abc123", "alice@example.com", "Alice Smith");

    expect(orgs.createOrganization).toHaveBeenCalledWith({
      name: "Alice Smith",
      ownerClerkUserId: "user_abc123",
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: "user_abc123",
        clerkOrganizationId: "org_new",
        email: "alice@example.com",
        name: "Alice Smith",
      }),
    );
  });

  it("falls back to email prefix when name is empty (also used as org name)", async () => {
    const repo = makeRepo();
    const orgs = makeOrgs();
    const useCase = new ProvisionAccountUseCase(repo, orgs);

    await useCase.execute("user_abc123", "bob@example.com", "");

    expect(orgs.createOrganization).toHaveBeenCalledWith({
      name: "bob",
      ownerClerkUserId: "user_abc123",
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "bob", clerkOrganizationId: "org_new" }),
    );
  });

  it("is idempotent — skips both org create and account create when account already exists", async () => {
    const repo = makeRepo({
      findByClerkId: jest.fn().mockResolvedValue({ clerkId: "user_abc123" }),
    });
    const orgs = makeOrgs();
    const useCase = new ProvisionAccountUseCase(repo, orgs);

    await useCase.execute("user_abc123", "alice@example.com", "Alice Smith");

    expect(orgs.createOrganization).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("propagates Clerk Org create failures (controller returns non-2xx → Svix retries)", async () => {
    const repo = makeRepo();
    const orgs = makeOrgs({
      createOrganization: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new ProvisionAccountUseCase(repo, orgs);

    await expect(
      useCase.execute("user_abc123", "alice@example.com", "Alice"),
    ).rejects.toThrow("clerk down");
    expect(repo.create).not.toHaveBeenCalled();
  });
});
