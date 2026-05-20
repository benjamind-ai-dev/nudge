import { Inject, Injectable } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../../users/domain/user.repository";
import { PendingUserNotFoundError } from "../../users/domain/user.errors";

export interface LinkInvitedUserInput {
  nudgeAccountId: string;
  nudgeUserId: string;
  clerkUserId: string;
}

@Injectable()
export class LinkInvitedUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(input: LinkInvitedUserInput): Promise<void> {
    const pending = await this.users.findByIdInAccount(
      input.nudgeUserId,
      input.nudgeAccountId,
    );
    if (!pending) {
      throw new PendingUserNotFoundError(input.nudgeUserId);
    }

    const linked = await this.users.linkClerkUserId({
      userId: input.nudgeUserId,
      accountId: input.nudgeAccountId,
      clerkUserId: input.clerkUserId,
    });
    if (!linked) {
      // Either accountId mismatched (defensive — already filtered above), or the row
      // is already linked to a DIFFERENT clerkUserId. Both are anomalies; surface.
      throw new PendingUserNotFoundError(input.nudgeUserId);
    }
    // Implicit success (linked, or no-op same value).
  }
}
