import { InviteUserUseCase } from "./invite-user.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { ClerkInvitationService } from "../domain/clerk-invitation.service";
import { EmailAlreadyInUseError, InviteSendFailedError } from "../domain/user.errors";
import type { UserListItem } from "../domain/user.entity";

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
  ...over,
});

const makeClerk = (over: Partial<ClerkInvitationService> = {}): ClerkInvitationService => ({
  createInvitation: jest.fn().mockResolvedValue({ clerkInvitationId: "inv_abc" }),
  ...over,
});

describe("InviteUserUseCase", () => {
  it("happy path — creates pending row, calls Clerk, returns row + invitation id", async () => {
    const repo = makeRepo();
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk);

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
      email: "x@example.com",
      accountId: "acc_1",
      userId: "new_user_id",
      role: "viewer",
    });
    expect(result.clerkInvitationId).toBe("inv_abc");
    expect(result.user.id).toBe("new_user_id");
  });

  it("name defaults to empty string when not provided", async () => {
    const repo = makeRepo();
    const useCase = new InviteUserUseCase(repo, makeClerk());
    await useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "admin" });
    expect((repo.createPending as jest.Mock).mock.calls[0][0].name).toBe("");
  });

  it("idempotent — returns existing pending row without calling Clerk again", async () => {
    const existing = mkUser({ id: "existing", email: "x@example.com", clerkUserId: null });
    const repo = makeRepo({ findByEmailInAccount: jest.fn().mockResolvedValue(existing) });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk);

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
    const useCase = new InviteUserUseCase(repo, makeClerk());

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it("throws EmailAlreadyInUseError when createPending hits global unique (cross-account)", async () => {
    const repo = makeRepo({
      createPending: jest.fn().mockRejectedValue(new EmailAlreadyInUseError("x@example.com")),
    });
    const clerk = makeClerk();
    const useCase = new InviteUserUseCase(repo, clerk);

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
    const useCase = new InviteUserUseCase(repo, clerk);

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
    const useCase = new InviteUserUseCase(repo, clerk);

    await expect(
      useCase.execute({ callerAccountId: "acc_1", email: "x@example.com", role: "viewer" }),
    ).rejects.toBeInstanceOf(InviteSendFailedError);
  });
});
