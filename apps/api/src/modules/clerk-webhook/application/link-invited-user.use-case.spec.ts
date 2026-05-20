import { LinkInvitedUserUseCase } from "./link-invited-user.use-case";
import { PendingUserNotFoundError } from "../../users/domain/user.errors";
import type { UserRepository } from "../../users/domain/user.repository";
import type { UserListItem } from "../../users/domain/user.entity";

const mkUser = (over: Partial<{ id: string; clerkUserId: string | null }> = {}): UserListItem => ({
  id: over.id ?? "pending_1",
  accountId: "acc_1",
  email: "x@example.com",
  name: "",
  role: "viewer" as const,
  lastLoginAt: null,
  clerkUserId: over.clerkUserId ?? null,
  clerkInvitationId: null,
});

const makeRepo = (over: Partial<UserRepository> = {}): UserRepository => ({
  findManyByAccount: jest.fn(),
  findByIdInAccount: jest.fn().mockResolvedValue(mkUser()),
  findByEmailInAccount: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn(),
  createPending: jest.fn(),
  deleteById: jest.fn(),
  linkClerkUserId: jest.fn().mockResolvedValue(mkUser({ clerkUserId: "user_clerk_x" })),
  setClerkInvitationId: jest.fn(),
  ...over,
});

describe("LinkInvitedUserUseCase", () => {
  const INPUT = {
    nudgeAccountId: "acc_1",
    nudgeUserId: "pending_1",
    clerkUserId: "user_clerk_x",
  };

  it("links the pending row when account + user match", async () => {
    const repo = makeRepo();
    const useCase = new LinkInvitedUserUseCase(repo);

    await useCase.execute(INPUT);

    expect(repo.linkClerkUserId).toHaveBeenCalledWith({
      userId: "pending_1",
      accountId: "acc_1",
      clerkUserId: "user_clerk_x",
    });
  });

  it("throws PendingUserNotFoundError when no pending row exists", async () => {
    const repo = makeRepo({ findByIdInAccount: jest.fn().mockResolvedValue(null) });
    const useCase = new LinkInvitedUserUseCase(repo);
    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(PendingUserNotFoundError);
  });

  it("throws PendingUserNotFoundError when linkClerkUserId returns null (account mismatch / different clerkUserId)", async () => {
    const repo = makeRepo({ linkClerkUserId: jest.fn().mockResolvedValue(null) });
    const useCase = new LinkInvitedUserUseCase(repo);
    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(PendingUserNotFoundError);
  });

  it("is a no-op success when the row is already linked to the same clerkUserId", async () => {
    const alreadyLinked = mkUser({ clerkUserId: "user_clerk_x" });
    const repo = makeRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(alreadyLinked),
      linkClerkUserId: jest.fn().mockResolvedValue(alreadyLinked),
    });
    const useCase = new LinkInvitedUserUseCase(repo);
    await expect(useCase.execute(INPUT)).resolves.toBeUndefined();
  });
});
