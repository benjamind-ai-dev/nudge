import { DeleteUserUseCase } from "./delete-user.use-case";
import type { UserRepository } from "../domain/user.repository";
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
  ...over,
});

describe("DeleteUserUseCase", () => {
  it("deletes a peer user", async () => {
    const repo = mkRepo();
    const useCase = new DeleteUserUseCase(repo);

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
    const useCase = new DeleteUserUseCase(repo);

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
    const useCase = new DeleteUserUseCase(repo);

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
    const useCase = new DeleteUserUseCase(repo);

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
    const useCase = new DeleteUserUseCase(repo);

    await expect(
      useCase.execute({
        callerUserId: "u-caller",
        accountId: "a-1",
        targetId: "u-target",
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
