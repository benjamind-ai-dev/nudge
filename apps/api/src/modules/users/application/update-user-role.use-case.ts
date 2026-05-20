import { Inject, Injectable } from "@nestjs/common";
import type { UserRole } from "../../../common/auth-context/caller-context.types";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import type { UserListItem } from "../domain/user.entity";
import {
  CannotChangeOwnRoleError,
  CannotChangeOwnerRoleError,
  UserNotFoundError,
} from "../domain/user.errors";

export interface UpdateUserRoleInput {
  callerUserId: string;
  accountId: string;
  targetId: string;
  newRole: Exclude<UserRole, "owner">;
}

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  async execute(input: UpdateUserRoleInput): Promise<UserListItem> {
    const target = await this.users.findByIdInAccount(
      input.targetId,
      input.accountId,
    );
    if (!target) throw new UserNotFoundError(input.targetId);

    if (target.id === input.callerUserId) {
      throw new CannotChangeOwnRoleError();
    }
    if (target.role === "owner") {
      throw new CannotChangeOwnerRoleError();
    }

    return this.users.updateRole(input.targetId, input.accountId, input.newRole);
  }
}
