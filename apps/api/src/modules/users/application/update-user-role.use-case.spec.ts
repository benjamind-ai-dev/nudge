import { UpdateUserRoleUseCase } from "./update-user-role.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { UserListItem } from "../domain/user.entity";
import {
  CannotChangeOwnRoleError,
  CannotChangeOwnerRoleError,
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
  updateRole: jest.fn().mockImplementation(async (_id, _acc, role) =>
    mkUser({ role }),
  ),
  delete: jest.fn(),
  createPending: jest.fn(),
  deleteById: jest.fn(),
  linkClerkUserId: jest.fn(),
  setClerkInvitationId: jest.fn(),
  findOwnerByAccount: jest.fn(),
  ...over,
});

describe("UpdateUserRoleUseCase", () => {
  it("updates a peer user's role and returns the updated row", async () => {
    const repo = mkRepo();
    const useCase = new UpdateUserRoleUseCase(repo);

    const result = await useCase.execute({
      callerUserId: "u-caller",
      accountId: "a-1",
      targetId: "u-target",
      newRole: "viewer",
    });

    expect(repo.findByIdInAccount).toHaveBeenCalledWith("u-target", "a-1");
    expect(repo.updateRole).toHaveBeenCalledWith("u-target", "a-1", "viewer");
    expect(result.role).toBe("viewer");
  });

  it("throws UserNotFoundError when target does not exist in account", async () => {
    const repo = mkRepo({ findByIdInAccount: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateUserRoleUseCase(repo);

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-missing",
        newRole: "viewer",
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it("throws CannotChangeOwnRoleError when target id equals caller id", async () => {
    const repo = mkRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ id: "u-caller" })),
    });
    const useCase = new UpdateUserRoleUseCase(repo);

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-caller",
        newRole: "viewer",
      }),
    ).rejects.toBeInstanceOf(CannotChangeOwnRoleError);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it("throws CannotChangeOwnerRoleError when target role is owner", async () => {
    const repo = mkRepo({
      findByIdInAccount: jest.fn().mockResolvedValue(mkUser({ role: "owner" })),
    });
    const useCase = new UpdateUserRoleUseCase(repo);

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-target",
        newRole: "viewer",
      }),
    ).rejects.toBeInstanceOf(CannotChangeOwnerRoleError);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });
});
