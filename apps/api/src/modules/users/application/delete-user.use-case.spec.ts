import { DeleteUserUseCase } from "./delete-user.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkOrganizationService } from "../domain/clerk-organization.service";
import type { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";
import type { UserListItem } from "../domain/user.entity";
import {
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  UserNotFoundError,
} from "../domain/user.errors";

const mkUser = (over: Partial<UserListItem> = {}): UserListItem => ({
  id: "u-target",
  accountId: "a-1",
  email: "t@example.com",
  name: "Target",
  role: "admin",
  lastLoginAt: null,
  clerkUserId: "user_target",
  clerkInvitationId: null,
  ...over,
});

const mkRepo = (over: Partial<UserRepository> = {}): UserRepository => ({
  findManyByAccount: jest.fn(),
  findByIdInAccount: jest.fn().mockResolvedValue(mkUser()),
  findByEmailInAccount: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn().mockResolvedValue(1),
  createPending: jest.fn(),
  deleteById: jest.fn(),
  linkClerkUserId: jest.fn(),
  setClerkInvitationId: jest.fn(),
  findOwnerByAccount: jest.fn(),
  ...over,
});

const mkClerkOrgs = (
  over: Partial<ClerkOrganizationService> = {},
): ClerkOrganizationService => ({
  createOrganization: jest.fn(),
  createOrganizationInvitation: jest.fn(),
  revokeOrganizationInvitation: jest.fn(),
  deleteOrganizationMembership: jest.fn().mockResolvedValue(undefined),
  createOrganizationMembership: jest.fn(),
  ...over,
});

const mkResolveOrg = (
  orgId = "org_acme",
): Pick<ResolveOrgIdForAccountUseCase, "execute"> => ({
  execute: jest.fn().mockResolvedValue(orgId),
});

describe("DeleteUserUseCase", () => {
  it("deletes a peer user", async () => {
    const repo = mkRepo();
    const clerkOrgs = mkClerkOrgs();
    const resolveOrg = mkResolveOrg();
    const useCase = new DeleteUserUseCase(
      repo,
      clerkOrgs,
      resolveOrg as ResolveOrgIdForAccountUseCase,
    );

    await useCase.execute({
      callerUserId: "u-caller",
      accountId: "a-1",
      targetId: "u-target",
    });

    expect(repo.findByIdInAccount).toHaveBeenCalledWith("u-target", "a-1");
    expect(repo.delete).toHaveBeenCalledWith("u-target", "a-1");
  });

  it("throws UserNotFoundError when target does not exist in account", async () => {
    const repo = mkRepo({ findByIdInAccount: jest.fn().mockResolvedValue(null) });
    const useCase = new DeleteUserUseCase(
      repo,
      mkClerkOrgs(),
      mkResolveOrg() as ResolveOrgIdForAccountUseCase,
    );

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-missing",
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws CannotRemoveSelfError when target id equals caller id", async () => {
    const repo = mkRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ id: "u-caller" })),
    });
    const useCase = new DeleteUserUseCase(
      repo,
      mkClerkOrgs(),
      mkResolveOrg() as ResolveOrgIdForAccountUseCase,
    );

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-caller",
      }),
    ).rejects.toBeInstanceOf(CannotRemoveSelfError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws CannotRemoveOwnerError when target role is owner", async () => {
    const repo = mkRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ role: "owner" })),
    });
    const useCase = new DeleteUserUseCase(
      repo,
      mkClerkOrgs(),
      mkResolveOrg() as ResolveOrgIdForAccountUseCase,
    );

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-target",
      }),
    ).rejects.toBeInstanceOf(CannotRemoveOwnerError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws UserNotFoundError when repo.delete reports 0 rows deleted", async () => {
    // Race: row vanished between findByIdInAccount and delete.
    const repo = mkRepo({ delete: jest.fn().mockResolvedValue(0) });
    const useCase = new DeleteUserUseCase(
      repo,
      mkClerkOrgs(),
      mkResolveOrg() as ResolveOrgIdForAccountUseCase,
    );

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-target",
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it("calls Clerk deleteOrganizationMembership before deleting the local row", async () => {
    const clerkOrgs = mkClerkOrgs();
    const resolveOrg = mkResolveOrg("org_acme");
    const repo = mkRepo({
      findByIdInAccount: jest
        .fn()
        .mockResolvedValue(mkUser({ clerkUserId: "user_clerk_target" })),
      delete: jest.fn().mockResolvedValue(1),
    });
    const useCase = new DeleteUserUseCase(
      repo,
      clerkOrgs,
      resolveOrg as ResolveOrgIdForAccountUseCase,
    );

    await useCase.execute({
      callerUserId: "u-caller",
      accountId: "a-1",
      targetId: "u-target",
    });

    expect(resolveOrg.execute).toHaveBeenCalledWith("a-1");
    expect(clerkOrgs.deleteOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_acme",
      clerkUserId: "user_clerk_target",
    });
    expect(repo.delete).toHaveBeenCalledWith("u-target", "a-1");
  });

  it("skips Clerk call when target has no clerkUserId (still pending invite)", async () => {
    const clerkOrgs = mkClerkOrgs();
    const resolveOrg = mkResolveOrg("org_acme");
    const repo = mkRepo({
      findByIdInAccount: jest
        .fn()
        .mockResolvedValue(mkUser({ clerkUserId: null })),
      delete: jest.fn().mockResolvedValue(1),
    });
    const useCase = new DeleteUserUseCase(
      repo,
      clerkOrgs,
      resolveOrg as ResolveOrgIdForAccountUseCase,
    );

    await useCase.execute({
      callerUserId: "u-caller",
      accountId: "a-1",
      targetId: "u-target",
    });

    expect(clerkOrgs.deleteOrganizationMembership).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalled();
  });

  it("proceeds with local delete when Clerk deleteOrganizationMembership fails (best-effort)", async () => {
    const clerkOrgs = mkClerkOrgs({
      deleteOrganizationMembership: jest
        .fn()
        .mockRejectedValue(new Error("clerk down")),
    });
    const resolveOrg = mkResolveOrg("org_acme");
    const repo = mkRepo({
      findByIdInAccount: jest
        .fn()
        .mockResolvedValue(mkUser({ clerkUserId: "user_clerk_target" })),
      delete: jest.fn().mockResolvedValue(1),
    });
    const useCase = new DeleteUserUseCase(
      repo,
      clerkOrgs,
      resolveOrg as ResolveOrgIdForAccountUseCase,
    );

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-target",
      }),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalled();
  });
});
