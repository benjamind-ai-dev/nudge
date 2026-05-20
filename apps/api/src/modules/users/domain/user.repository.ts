import type { UserRole } from "../../../common/auth-context/caller-context.types";
import type { UserListItem } from "./user.entity";

export const USER_REPOSITORY = Symbol("UserRepository");

export interface UserRepository {
  findManyByAccount(accountId: string): Promise<UserListItem[]>;
  findByIdInAccount(id: string, accountId: string): Promise<UserListItem | null>;
  updateRole(
    id: string,
    accountId: string,
    role: Exclude<UserRole, "owner">,
  ): Promise<UserListItem>;
  /** Returns the number of rows deleted (0 or 1). */
  delete(id: string, accountId: string): Promise<number>;
}
