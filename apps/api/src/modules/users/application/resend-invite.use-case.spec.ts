import { ResendInviteUseCase } from "./resend-invite.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkInvitationService } from "../domain/clerk-invitation.service";
import {
  CannotCancelAcceptedInviteError,
  InviteSendFailedError,
  PendingUserNotFoundError,
} from "../domain/user.errors";
import type { UserListItem } from "../domain/user.entity";

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
  findOwnerByAccount: jest.fn(),
  ...over,
});

const makeClerk = (over: Partial<ClerkInvitationService> = {}): ClerkInvitationService => ({
  createInvitation: jest.fn().mockResolvedValue({ clerkInvitationId: "inv_new" }),
  revokeInvitation: jest.fn().mockResolvedValue(undefined),
  ...over,
});

describe("ResendInviteUseCase", () => {
  it("happy path — revokes old, creates new, persists new id, returns user + new id", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const useCase = new ResendInviteUseCase(repo, clerk);

    const result = await useCase.execute({
      callerAccountId: ACCOUNT_ID,
      targetId: TARGET_ID,
    });

    expect(clerk.revokeInvitation).toHaveBeenCalledWith({ clerkInvitationId: "inv_old" });
    expect(clerk.createInvitation).toHaveBeenCalledWith({
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
    const useCase = new ResendInviteUseCase(repo, makeClerk());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(PendingUserNotFoundError);
  });

  it("throws CannotCancelAcceptedInviteError when target.clerkUserId is non-null", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ clerkUserId: "user_clerk_x" })),
    });
    const clerk = makeClerk();
    const useCase = new ResendInviteUseCase(repo, clerk);

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
    const useCase = new ResendInviteUseCase(repo, clerk);

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
    const useCase = new ResendInviteUseCase(repo, clerk);

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
    const useCase = new ResendInviteUseCase(repo, clerk);

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
    const useCase = new ResendInviteUseCase(repo, clerk);

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
    const useCase = new ResendInviteUseCase(repo, makeClerk());

    // Owner rows always have a non-null clerkUserId in practice; if we ever see
    // role=owner with clerkUserId=null this is a data bug. We do NOT treat it as
    // resendable. The test above covers clerkUserId=non-null, so this case only
    // matters if the data is wrong — covered by the role-guard branch in the
    // use case (or alternatively: the same accepted-invite error path).
    // Implementation: throw CannotCancelAcceptedInviteError when role === 'owner'.
    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(CannotCancelAcceptedInviteError);
  });
});
