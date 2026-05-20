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
import type { UserListItem } from "../domain/user.entity";
import {
  EmailAlreadyInUseError,
  InviteSendFailedError,
} from "../domain/user.errors";

export interface InviteUserInput {
  callerAccountId: string;
  email: string;
  role: "admin" | "viewer";
  name?: string;
}

export interface InviteUserResult {
  user: UserListItem;
  /** Null when this was an idempotent re-invite for an already-pending row. */
  clerkInvitationId: string | null;
}

@Injectable()
export class InviteUserUseCase {
  private readonly logger = new Logger(InviteUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLERK_INVITATION_SERVICE) private readonly clerk: ClerkInvitationService,
    private readonly resolveOrg: ResolveOrgIdForAccountUseCase,
  ) {}

  async execute(input: InviteUserInput): Promise<InviteUserResult> {
    const existing = await this.users.findByEmailInAccount(input.email, input.callerAccountId);
    if (existing) {
      if (existing.clerkUserId === null) {
        // Idempotent re-invite. Do NOT call Clerk again (would create a duplicate invitation).
        return { user: existing, clerkInvitationId: null };
      }
      throw new EmailAlreadyInUseError(input.email);
    }

    const organizationId = await this.resolveOrg.execute(input.callerAccountId);
    const owner = await this.users.findOwnerByAccount(input.callerAccountId);
    const inviterClerkUserId = owner?.clerkUserId ?? null;

    // createPending throws EmailAlreadyInUseError on Prisma P2002 (cross-account collision).
    const pending = await this.users.createPending({
      accountId: input.callerAccountId,
      email: input.email,
      name: input.name ?? "",
      role: input.role,
    });

    try {
      const { clerkInvitationId } = await this.clerk.createInvitation({
        organizationId,
        inviterClerkUserId,
        email: input.email,
        accountId: input.callerAccountId,
        userId: pending.id,
        role: input.role,
      });

      // Best-effort: persist the invitation id on the pending row. Failure to
      // persist does NOT roll back the row — the invitation was sent and the row
      // is usable; we just lose the historical pointer. Cancel/resend on this
      // row will fall through to the "no prior invitation id" branch (skip revoke).
      try {
        await this.users.setClerkInvitationId(
          pending.id,
          input.callerAccountId,
          clerkInvitationId,
        );
      } catch (setErr) {
        this.logger.error({
          msg: "Failed to persist clerkInvitationId on pending user row",
          event: "invite_set_invitation_id_failed",
          pendingUserId: pending.id,
          clerkInvitationId,
          error: setErr instanceof Error ? setErr.message : String(setErr),
        });
      }

      return { user: pending, clerkInvitationId };
    } catch (clerkErr) {
      // Best-effort rollback of the pending row.
      try {
        await this.users.deleteById(pending.id, input.callerAccountId);
      } catch (rollbackErr) {
        this.logger.error({
          msg: "Invite rollback failed — orphan pending user row left in DB",
          event: "invite_rollback_failed",
          pendingUserId: pending.id,
          rollbackError:
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        });
      }
      throw new InviteSendFailedError(input.email, clerkErr);
    }
  }
}
