import { ListUsersUseCase } from "./list-users.use-case";
import type { UserRepository } from "../domain/user.repository";
import type { UserListItem } from "../domain/user.entity";

const mkUser = (over: Partial<UserListItem> = {}): UserListItem => ({
  id: "u-1",
  accountId: "a-1",
  email: "a@example.com",
  name: "Alice",
  role: "owner",
  lastLoginAt: null,
  clerkUserId: "user_alice",
  ...over,
});

const mkRepo = (over: Partial<UserRepository> = {}): UserRepository => ({
  findManyByAccount: jest.fn().mockResolvedValue([]),
  findByIdInAccount: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn(),
  ...over,
});

describe("ListUsersUseCase", () => {
  it("returns the repo result", async () => {
    const users = [mkUser({ id: "u-1" }), mkUser({ id: "u-2", role: "admin", name: "Bob" })];
    const repo = mkRepo({
      findManyByAccount: jest.fn().mockResolvedValue(users),
    });
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute("a-1");

    expect(result).toEqual(users);
    expect(repo.findManyByAccount).toHaveBeenCalledWith("a-1");
  });

  it("returns an empty array when no users exist", async () => {
    const repo = mkRepo();
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute("a-empty");

    expect(result).toEqual([]);
  });
});
