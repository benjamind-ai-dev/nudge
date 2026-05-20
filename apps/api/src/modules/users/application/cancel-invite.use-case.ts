import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import {
  CLERK_INVITATION_SERVICE,
  type ClerkInvitationService,
} from "../domain/clerk-invitation.service";
import { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";
import {
  CannotCancelAcceptedInviteError,
  PendingUserNotFoundError,
} from "../domain/user.errors";

export interface CancelInviteInput {
  callerAccountId: string;
  targetId: string;
}

@Injectable()
export class CancelInviteUseCase {
  private readonly logger = new Logger(CancelInviteUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLERK_INVITATION_SERVICE) private readonly clerk: ClerkInvitationService,
    private readonly resolveOrg: ResolveOrgIdForAccountUseCase,
  ) {}

  async execute(input: CancelInviteInput): Promise<void> {
    const target = await this.users.findByIdInAccount(
      input.targetId,
      input.callerAccountId,
    );
    if (!target) throw new PendingUserNotFoundError(input.targetId);
    if (target.clerkUserId !== null) {
      throw new CannotCancelAcceptedInviteError(input.targetId);
    }

    // Best-effort Clerk revoke. Failures are logged and swallowed — the local
    // deletion is the source of truth from Nudge's perspective.
    if (target.clerkInvitationId !== null) {
      const organizationId = await this.resolveOrg.execute(input.callerAccountId);
      try {
        await this.clerk.revokeInvitation({
          organizationId,
          clerkInvitationId: target.clerkInvitationId,
        });
      } catch (revokeErr) {
        this.logger.warn({
          msg: "Clerk revokeOrganizationInvitation failed during cancel — proceeding with local delete",
          event: "clerk_invitation_revoke_failed",
          targetId: input.targetId,
          clerkInvitationId: target.clerkInvitationId,
          error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
        });
      }
    }

    const deleted = await this.users.deleteById(
      input.targetId,
      input.callerAccountId,
    );
    if (deleted === 0) {
      throw new PendingUserNotFoundError(input.targetId);
    }
  }
}
