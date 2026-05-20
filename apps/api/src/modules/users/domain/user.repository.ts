import type { UserRole } from "../../../common/auth-context/caller-context.types";
import type { UserListItem } from "./user.entity";

export const USER_REPOSITORY = Symbol("UserRepository");

export interface UserRepository {
  findManyByAccount(accountId: string): Promise<UserListItem[]>;
  findByIdInAccount(id: string, accountId: string): Promise<UserListItem | null>;
  findByEmailInAccount(email: string, accountId: string): Promise<UserListItem | null>;
  updateRole(
    id: string,
    accountId: string,
    role: Exclude<UserRole, "owner">,
  ): Promise<UserListItem>;
  /** Returns the number of rows deleted (0 or 1). */
  delete(id: string, accountId: string): Promise<number>;

  /**
   * Creates a pending user row (clerkUserId = null) and returns it.
   * Throws EmailAlreadyInUseError if Prisma P2002 fires on the global-unique email column.
   */
  createPending(params: {
    accountId: string;
    email: string;
    name: string;
    role: Exclude<UserRole, "owner">;
  }): Promise<UserListItem>;

  /**
   * Hard-deletes a single user row by (id, accountId). Used by invite rollback.
   * Account-scoped per the forbidden.rule.md tenancy guarantee. Returns 0 or 1.
   */
  deleteById(id: string, accountId: string): Promise<number>;

  /**
   * Idempotent: sets clerk_user_id on a pending row. Returns the updated row,
   * or null if no pending row with matching id and accountId exists, or if
   * clerk_user_id was already set to a different value.
   */
  linkClerkUserId(params: {
    userId: string;
    accountId: string;
    clerkUserId: string;
  }): Promise<UserListItem | null>;
}
