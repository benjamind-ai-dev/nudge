import { PLAN_LIMITS } from "@nudge/shared";
import { InviteUserUseCase } from "./invite-user.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkInvitationService } from "../domain/clerk-invitation.service";
import {
  EmailAlreadyInUseError,
  InviteSendFailedError,
  SeatLimitReachedError,
} from "../domain/user.errors";
import type { UserListItem } from "../domain/user.entity";
import type { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";
import type { EntitlementsService } from "../../../common/entitlements/entitlements.service";

const makeEntitlements = (
  over: Partial<EntitlementsService> = {},
): EntitlementsService =>
  ({
    limitsForAccount: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    limitsForBusiness: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    seatUsage: jest.fn().mockResolvedValue(1),
    ...over,
  }) as unknown as EntitlementsService;

const mkUser = (
  over: Partial<{
    id: string;
    email: string;
    clerkUserId: string | null;
    role: "owner" | "admin" | "viewer";
  }> = {},
): UserListItem => ({
  id: over.id ?? "u1",
  accountId: "acc_1",
  email: over.email ?? "x@example.com",
  name: "",
  role: over.role ?? "viewer",
  lastLoginAt: null,
  clerkUserId: over.clerkUserId ?? null,
  clerkInvitationId: null,
});

const makeRepo = (over: Partial<UserRepository> = {}): UserRepository => ({
  findManyByAccount: jest.fn(),
  findByIdInAccount: jest.fn(),
  findByEmailInAccount: jest.fn().mockResolvedValue(null),
  updateRole: jest.fn(),
  delete: jest.fn(),
  createPending: jest.fn().mockResolvedValue(mkUser({ id: "new_user_id" })),
  deleteById: jest.fn().mockResolvedValue(1),
  linkClerkUserId: jest.fn(),
  setClerkInvitationId: jest.fn().mockResolvedValue(1),
  findOwnerByAccount: jest.fn().mockResolvedValue({
    id: "user_owner_db",
    accountId: "acc_1",
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
  createInvitation: jest.fn().mockResolvedValue({ clerkInvitationId: "inv_abc" }),
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

describe("InviteUserUseCase", () => {
  it("happy path — creates pending row, calls Clerk, returns row + invitation id", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const resolveOrg = makeResolveOrg();
    const useCase = new InviteUserUseCase(repo, clerk, resolveOrg, makeEntitlements());

    const result = await useCase.execute({
      callerAccountId: "acc_1",
      email: "x@example.com",
      role: "viewer",
      name: "X",
    });

    expect(repo.createPending).toHaveBeenCalledWith({
      accountId: "acc_1",
      email: "x@example.com",
      name: "X",
      role: "viewer",
    });
    expect(clerk.createInvitation).toHaveBeenCalledWith({
      organizationId: "org_acme",
      inviterClerkUserId: "user_owner_clerk",
      email: "x@example.com",
      accountId: "acc_1",
      userId: "new_user_id",
      role: "viewer",
    });
    expect(result.clerkInvitationId).toBe("inv_abc");
    expect(result.user.id).toBe("new_user_id");
  });

  it("resolves the org id and passes it to Clerk createInvitation", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const resolveOrg = makeResolveOrg();
    const useCase = new InviteUserUseCase(repo, clerk, resolveOrg, makeEntitlements());

    await useCase.execute({
      callerAccountId: "acc_1",
      email: "newbie@example.com",
      role: "viewer",
    });

    expect(resolveOrg.execute).toHaveBeenCalledWith("acc_1");
    expect(clerk.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_acme",
        inviterClerkUserId: "user_owner_clerk",
        email: "newbie@example.com",
        role: "viewer",
      }),
    );
  });

  it("passes null inviterClerkUserId when owner has no clerkUserId", async () => {
    const repo = makeRepo({
      findOwnerByAccount: jest.fn().mockResolvedValue({
        id: "owner_db",
        accountId: "acc_1",
        email: "owner@example.com",
        name: "Owner",
        role: "owner",
        lastLoginAt: null,
        clerkUserId: null,
        clerkInvitationId: null,
      }),
    });
    const clerk = makeClerk();
    const resolveOrg = makeResolveOrg();
    const useCase = new InviteUserUseCase(repo, clerk, resolveOrg, makeEntitlements());

    await useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" });

    expect(clerk.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ inviterClerkUserId: null }),
    );
  });

  it("name defaults to empty string when not provided", async () => {
    const repo = makeRepo();
    const useCase = new InviteUserUseCase(repo, makeClerk(), makeResolveOrg(), makeEntitlements());
    await useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "admin" });
    expect((repo.createPending as jest.Mock).mock.calls[0][0].name).toBe("");
  });

  it("idempotent — returns existing pending row without calling Clerk again", async () => {
    const existing = mkUser({ id: "existing", email: "x@example.com", clerkUserId: null });
    const repo = makeRepo({ findByEmailInAccount: jest.fn().mockResolvedValue(existing) });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    const result = await useCase.execute({
      callerAccountId: "acc_1",
      email: "x@example.com",
      role: "viewer",
    });

    expect(repo.createPending).not.toHaveBeenCalled();
    expect(clerk.createInvitation).not.toHaveBeenCalled();
    expect(result.user.id).toBe("existing");
    expect(result.clerkInvitationId).toBeNull();
  });

  it("throws EmailAlreadyInUseError when email belongs to an active user in this account", async () => {
    const active = mkUser({ id: "active", email: "x@example.com", clerkUserId: "user_clerk_x" });
    const repo = makeRepo({ findByEmailInAccount: jest.fn().mockResolvedValue(active) });
    const useCase = new InviteUserUseCase(repo, makeClerk(), makeResolveOrg(), makeEntitlements());

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it("throws EmailAlreadyInUseError when createPending hits global unique (cross-account)", async () => {
    const repo = makeRepo({
      createPending: jest.fn().mockRejectedValue(new EmailAlreadyInUseError("x@example.com")),
    });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
    expect(clerk.createInvitation).not.toHaveBeenCalled();
  });

  it("rolls back the pending row when Clerk throws, then throws InviteSendFailedError", async () => {
    const repo = makeRepo();
    const clerk = makeClerk({
      createInvitation: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(InviteSendFailedError);
    expect(repo.deleteById).toHaveBeenCalledWith("new_user_id", "acc_1");
  });

  it("still throws InviteSendFailedError even when rollback delete also fails", async () => {
    const repo = makeRepo({
      deleteById: jest.fn().mockRejectedValue(new Error("db down")),
    });
    const clerk = makeClerk({
      createInvitation: jest.fn().mockRejectedValue(new Error("clerk down")),
    });
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(InviteSendFailedError);
  });

  it("persists clerkInvitationId on the pending row after Clerk createInvitation succeeds", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    await useCase.execute({
      callerAccountId: "acc_1",
      email: "x@example.com",
      role: "viewer",
    });

    expect(repo.setClerkInvitationId).toHaveBeenCalledWith(
      "new_user_id",
      "acc_1",
      "inv_abc",
    );
  });

  it("setClerkInvitationId failure does NOT roll back and does NOT throw", async () => {
    const repo = makeRepo({
      setClerkInvitationId: jest.fn().mockRejectedValue(new Error("db hiccup")),
    });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), makeEntitlements());

    const result = await useCase.execute({
      callerAccountId: "acc_1",
      email: "x@example.com",
      role: "viewer",
    });

    expect(result.clerkInvitationId).toBe("inv_abc");
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("throws SeatLimitReachedError when account is at its plan seat cap", async () => {
    const repo = makeRepo();
    const entitlements = makeEntitlements({
      limitsForAccount: jest.fn().mockResolvedValue(PLAN_LIMITS.starter), // maxSeats 1
      seatUsage: jest.fn().mockResolvedValue(1),
    });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk, makeResolveOrg(), entitlements);

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "new@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(SeatLimitReachedError);
    expect(repo.createPending).not.toHaveBeenCalled();
    expect(clerk.createInvitation).not.toHaveBeenCalled();
  });

  it("allows invite when under the seat cap", async () => {
    const repo = makeRepo();
    const entitlements = makeEntitlements({
      limitsForAccount: jest.fn().mockResolvedValue(PLAN_LIMITS.growth), // maxSeats 5
      seatUsage: jest.fn().mockResolvedValue(3),
    });
    const useCase = new InviteUserUseCase(repo, makeClerk(), makeResolveOrg(), entitlements);

    await useCase.execute({ callerAccountId: "acc_1", email: "new@example.com", role: "viewer" });
    expect(repo.createPending).toHaveBeenCalled();
  });
});
