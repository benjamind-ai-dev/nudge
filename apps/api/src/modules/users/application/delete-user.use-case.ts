import { Inject, Injectable } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import {
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  UserNotFoundError,
} from "../domain/user.errors";

export interface DeleteUserInput {
  callerUserId: string;
  accountId: string;
  targetId: string;
}

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  // TODO: best-effort Clerk org-membership revoke once Clerk Organizations are
  // adopted. Today the codebase has no Account.organizationId and no
  // clerk.organizations.* usage, and clerk.users.deleteUser would
  // deauthenticate the user globally (wrong). See plan
  // docs/superpowers/plans/2026-05-20-user-crud.md "Clerk integration decision".
  async execute(input: DeleteUserInput): Promise<void> {
    const target = await this.users.findByIdInAccount(
      input.targetId,
      input.accountId,
    );
    if (!target) throw new UserNotFoundError(input.targetId);

    if (target.id === input.callerUserId) {
      throw new CannotRemoveSelfError();
    }
    if (target.role === "owner") {
      throw new CannotRemoveOwnerError();
    }

    const deleted = await this.users.delete(input.targetId, input.accountId);
    if (deleted === 0) {
      throw new UserNotFoundError(input.targetId);
    }
  }
}
