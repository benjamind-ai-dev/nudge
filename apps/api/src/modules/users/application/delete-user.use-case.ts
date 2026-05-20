import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  USER_REPOSITORY,
  type UserRepository,
} from "../domain/user.repository";
import {
  CLERK_ORGANIZATION_SERVICE,
  type ClerkOrganizationService,
} from "../domain/clerk-organization.service";
import { ResolveOrgIdForAccountUseCase } from "../../clerk-webhook/application/resolve-org-id-for-account.use-case";
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
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(CLERK_ORGANIZATION_SERVICE)
    private readonly clerkOrgs: ClerkOrganizationService,
    private readonly resolveOrg: ResolveOrgIdForAccountUseCase,
  ) {}

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

    // Best-effort: revoke Clerk Organizations membership. Only if the target
    // is an accepted user (has a clerkUserId). Pending invitees with only a
    // clerkInvitationId have no org membership yet — the invitation handles
    // its own lifecycle via cancel/resend.
    if (target.clerkUserId) {
      try {
        const organizationId = await this.resolveOrg.execute(input.accountId);
        await this.clerkOrgs.deleteOrganizationMembership({
          organizationId,
          clerkUserId: target.clerkUserId,
        });
      } catch (clerkErr) {
        this.logger.warn({
          msg: "Clerk deleteOrganizationMembership failed during user delete — proceeding with local delete",
          event: "clerk_org_membership_delete_failed",
          targetId: input.targetId,
          accountId: input.accountId,
          error: clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
        });
      }
    }

    const deleted = await this.users.delete(input.targetId, input.accountId);
    if (deleted === 0) {
      throw new UserNotFoundError(input.targetId);
    }
  }
}
