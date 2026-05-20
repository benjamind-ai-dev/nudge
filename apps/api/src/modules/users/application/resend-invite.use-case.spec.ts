import { ResendInviteUseCase } from "./resend-invite.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkInvitationService } from "../domain/clerk-invitation.service";
import {
  CannotCancelAcceptedInviteError,
  InviteSendFailedError,
  PendingUserNotFoundError,
} from "../domain/user.errors";
import type { UserListItem } from "../domain/user.entity";
import type { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";

const ACCOUNT_ID = "acc_1";
const TARGET_ID = "u_target";

const mkUser = (over: Partial<UserListItem> = {}): UserListItem => ({
  id: TARGET_ID,
  accountId: ACCOUNT_ID,
  email: "t@example.com",
  name: "T",
  role: "viewer",
  lastLoginAt: null,
  clerkUserId: null,
  clerkInvitationId: "inv_old",
  ...over,
});

const makeRepo = (over: Partial<UserRepository> = {}): UserRepository => ({
  findManyByAccount: jest.fn(),
  findByIdInAccount: jest.fn().mockResolvedValue(mkUser()),
  findByEmailInAccount: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn(),
  createPending: jest.fn(),
  deleteById: jest.fn(),
  linkClerkUserId: jest.fn(),
  setClerkInvitationId: jest.fn().mockResolvedValue(1),
  findOwnerByAccount: jest.fn().mockResolvedValue({
    id: "user_owner_db",
    accountId: ACCOUNT_ID,
    email: "owner@example.com",
    name: "Owner",
    role: "owner",
    lastLoginAt: null,
    clerkUserId: "user_owner_clerk",
    clerkInvitationId: null,
  }),
  ...over,
});

const makeClerk = (over: Partial<ClerkInvitationService> = {}): ClerkInvitationService => ({
  createInvitation: jest.fn().mockResolvedValue({ clerkInvitationId: "inv_new" }),
  revokeInvitation: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const makeResolveOrg = (
  over: Partial<ResolveOrgIdForAccountUseCase> = {},
): ResolveOrgIdForAccountUseCase =>
  ({
    execute: jest.fn().mockResolvedValue("org_acme"),
    ...over,
  }) as unknown as ResolveOrgIdForAccountUseCase;

describe("ResendInviteUseCase", () => {
  it("happy path — revokes old (org-scoped), creates new, persists new id, returns user + new id", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const resolveOrg = makeResolveOrg();
    const useCase = new ResendInviteUseCase(repo, clerk, resolveOrg);

    const result = await useCase.execute({
      callerAccountId: ACCOUNT_ID,
      targetId: TARGET_ID,
    });

    expect(resolveOrg.execute).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(clerk.revokeInvitation).toHaveBeenCalledWith({
      organizationId: "org_acme",
      clerkInvitationId: "inv_old",
    });
    expect(clerk.createInvitation).toHaveBeenCalledWith({
      organizationId: "org_acme",
      inviterClerkUserId: "user_owner_clerk",
      email: "t@example.com",
      accountId: ACCOUNT_ID,
      userId: TARGET_ID,
      role: "viewer",
    });
    expect(repo.setClerkInvitationId).toHaveBeenCalledWith(TARGET_ID, ACCOUNT_ID, "inv_new");
    expect(result).toEqual({
      user: expect.objectContaining({ id: TARGET_ID }),
      clerkInvitationId: "inv_new",
    });
  });

  it("throws PendingUserNotFoundError when target is missing", async () => {
    const repo = makeRepo({ findByIdInAccount: jest.fn().mockResolvedValue(null) });
    const useCase = new ResendInviteUseCase(repo, makeClerk(), makeResolveOrg());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(PendingUserNotFoundError);
  });

  it("throws CannotCancelAcceptedInviteError when target.clerkUserId is non-null", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ clerkUserId: "user_clerk_x" })),
    });
    const clerk = makeClerk();
    const useCase = new ResendInviteUseCase(repo, clerk, makeResolveOrg());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(CannotCancelAcceptedInviteError);
    expect(clerk.createInvitation).not.toHaveBeenCalled();
  });

  it("skips revoke when no prior clerkInvitationId (legacy pending row)", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ clerkInvitationId: null })),
    });
    const clerk = makeClerk();
    const useCase = new ResendInviteUseCase(repo, clerk, makeResolveOrg());

    const result = await useCase.execute({
      callerAccountId: ACCOUNT_ID,
      targetId: TARGET_ID,
    });

    expect(clerk.revokeInvitation).not.toHaveBeenCalled();
    expect(clerk.createInvitation).toHaveBeenCalled();
    expect(result.clerkInvitationId).toBe("inv_new");
  });

  it("revoke failure is best-effort — still creates new invitation", async () => {
    const repo = makeRepo();
    const clerk = makeClerk({
      revokeInvitation: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new ResendInviteUseCase(repo, clerk, makeResolveOrg());

    const result = await useCase.execute({
      callerAccountId: ACCOUNT_ID,
      targetId: TARGET_ID,
    });

    expect(result.clerkInvitationId).toBe("inv_new");
    expect(repo.setClerkInvitationId).toHaveBeenCalledWith(TARGET_ID, ACCOUNT_ID, "inv_new");
  });

  it("createInvitation failure throws InviteSendFailedError and leaves DB unchanged", async () => {
    const repo = makeRepo();
    const clerk = makeClerk({
      createInvitation: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new ResendInviteUseCase(repo, clerk, makeResolveOrg());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(InviteSendFailedError);
    expect(repo.setClerkInvitationId).not.toHaveBeenCalled();
  });

  it("setClerkInvitationId failure does NOT throw — Clerk is source of truth", async () => {
    const repo = makeRepo({
      setClerkInvitationId: jest.fn().mockRejectedValue(new Error("db hiccup")),
    });
    const clerk = makeClerk();
    const useCase = new ResendInviteUseCase(repo, clerk, makeResolveOrg());

    const result = await useCase.execute({
      callerAccountId: ACCOUNT_ID,
      targetId: TARGET_ID,
    });

    expect(result.clerkInvitationId).toBe("inv_new");
  });

  it("rejects owner targets defensively (a pending row should never be owner, but guard anyway)", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ role: "owner" })),
    });
    const useCase = new ResendInviteUseCase(repo, makeClerk(), makeResolveOrg());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(CannotCancelAcceptedInviteError);
  });
});
