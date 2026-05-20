import { CancelInviteUseCase } from "./cancel-invite.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkInvitationService } from "../domain/clerk-invitation.service";
import {
  CannotCancelAcceptedInviteError,
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
  deleteById: jest.fn().mockResolvedValue(1),
  linkClerkUserId: jest.fn(),
  setClerkInvitationId: jest.fn(),
  ...over,
});

const makeClerk = (over: Partial<ClerkInvitationService> = {}): ClerkInvitationService => ({
  createInvitation: jest.fn(),
  revokeInvitation: jest.fn().mockResolvedValue(undefined),
  ...over,
});

describe("CancelInviteUseCase", () => {
  it("happy path — revokes Clerk invitation and deletes pending row", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const useCase = new CancelInviteUseCase(repo, clerk);

    await useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID });

    expect(clerk.revokeInvitation).toHaveBeenCalledWith({ clerkInvitationId: "inv_old" });
    expect(repo.deleteById).toHaveBeenCalledWith(TARGET_ID, ACCOUNT_ID);
  });

  it("throws PendingUserNotFoundError when target is missing in this account", async () => {
    const repo = makeRepo({ findByIdInAccount: jest.fn().mockResolvedValue(null) });
    const clerk = makeClerk();
    const useCase = new CancelInviteUseCase(repo, clerk);

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(PendingUserNotFoundError);
    expect(clerk.revokeInvitation).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("throws CannotCancelAcceptedInviteError when target.clerkUserId is non-null", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ clerkUserId: "user_clerk_x" })),
    });
    const clerk = makeClerk();
    const useCase = new CancelInviteUseCase(repo, clerk);

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(CannotCancelAcceptedInviteError);
    expect(clerk.revokeInvitation).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("Clerk revoke failure is best-effort — local delete still succeeds", async () => {
    const repo = makeRepo();
    const clerk = makeClerk({
      revokeInvitation: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new CancelInviteUseCase(repo, clerk);

    await useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID });

    expect(repo.deleteById).toHaveBeenCalledWith(TARGET_ID, ACCOUNT_ID);
  });

  it("skips Clerk revoke when target has no clerkInvitationId (legacy pending row)", async () => {
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ clerkInvitationId: null })),
    });
    const clerk = makeClerk();
    const useCase = new CancelInviteUseCase(repo, clerk);

    await useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID });

    expect(clerk.revokeInvitation).not.toHaveBeenCalled();
    expect(repo.deleteById).toHaveBeenCalledWith(TARGET_ID, ACCOUNT_ID);
  });

  it("throws PendingUserNotFoundError when deleteById returns 0 (race)", async () => {
    const repo = makeRepo({ deleteById: jest.fn().mockResolvedValue(0) });
    const useCase = new CancelInviteUseCase(repo, makeClerk());

    await expect(
      useCase.execute({ callerAccountId: ACCOUNT_ID, targetId: TARGET_ID }),
    ).rejects.toBeInstanceOf(PendingUserNotFoundError);
  });
});
