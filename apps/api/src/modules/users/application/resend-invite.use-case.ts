import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import {
  CLERK_INVITATION_SERVICE,
  type ClerkInvitationService,
} from "../domain/clerk-invitation.service";
import type { UserListItem } from "../domain/user.entity";
import {
  CannotCancelAcceptedInviteError,
  InviteSendFailedError,
  PendingUserNotFoundError,
} from "../domain/user.errors";

export interface ResendInviteInput {
  callerAccountId: string;
  targetId: string;
}

export interface ResendInviteResult {
  user: UserListItem;
  clerkInvitationId: string;
}

@Injectable()
export class ResendInviteUseCase {
  private readonly logger = new Logger(ResendInviteUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLERK_INVITATION_SERVICE) private readonly clerk: ClerkInvitationService,
  ) {}

  async execute(input: ResendInviteInput): Promise<ResendInviteResult> {
    const target = await this.users.findByIdInAccount(
      input.targetId,
      input.callerAccountId,
    );
    if (!target) throw new PendingUserNotFoundError(input.targetId);
    if (target.clerkUserId !== null || target.role === "owner") {
      throw new CannotCancelAcceptedInviteError(input.targetId);
    }
    // After the guards above we know target.role is 'admin' | 'viewer'.
    const role: "admin" | "viewer" = target.role;

    // Best-effort revoke of the prior invitation. Don't block resend on this.
    if (target.clerkInvitationId !== null) {
      try {
        await this.clerk.revokeInvitation({
          clerkInvitationId: target.clerkInvitationId,
        });
      } catch (revokeErr) {
        this.logger.warn({
          msg: "Clerk revokeInvitation failed during resend — proceeding to issue new invitation",
          event: "clerk_invitation_revoke_failed",
          targetId: input.targetId,
          clerkInvitationId: target.clerkInvitationId,
          error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
        });
      }
    }

    // Issue the new invitation. If this fails, the DB row is unchanged.
    let newClerkInvitationId: string;
    try {
      const result = await this.clerk.createInvitation({
        email: target.email,
        accountId: input.callerAccountId,
        userId: target.id,
        role,
      });
      newClerkInvitationId = result.clerkInvitationId;
    } catch (createErr) {
      throw new InviteSendFailedError(target.email, createErr);
    }

    // Best-effort persist of the new id. If this fails, the Clerk invitation
    // still exists and the row's old id is stale — Clerk is authoritative.
    try {
      await this.users.setClerkInvitationId(
        target.id,
        input.callerAccountId,
        newClerkInvitationId,
      );
    } catch (setErr) {
      this.logger.error({
        msg: "Failed to persist new clerkInvitationId after resend — Clerk invitation already created",
        event: "resend_set_invitation_id_failed",
        targetId: input.targetId,
        clerkInvitationId: newClerkInvitationId,
        error: setErr instanceof Error ? setErr.message : String(setErr),
      });
    }

    return {
      user: { ...target, clerkInvitationId: newClerkInvitationId },
      clerkInvitationId: newClerkInvitationId,
    };
  }
}
