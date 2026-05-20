import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import type { Env } from "../../../common/config/env.schema";
import type {
  ClerkInvitationService as IClerkInvitationService,
  CreateInvitationParams,
  CreateInvitationResult,
  RevokeInvitationParams,
} from "../domain/clerk-invitation.service";
import { mapNudgeRoleToClerkRole } from "../domain/clerk-role";

@Injectable()
export class ClerkInvitationService implements IClerkInvitationService {
  private readonly logger = new Logger(ClerkInvitationService.name);
  private readonly client: ReturnType<typeof createClerkClient>;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = createClerkClient({
      secretKey: this.config.get("CLERK_SECRET_KEY", { infer: true }),
    });
  }

  async createInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult> {
    try {
      const invitation = await this.client.organizations.createOrganizationInvitation({
        organizationId: params.organizationId,
        // Clerk SDK expects `string | undefined`, not `string | null`
        inviterUserId: params.inviterClerkUserId ?? undefined,
        emailAddress: params.email,
        role: mapNudgeRoleToClerkRole(params.role),
        publicMetadata: {
          nudgeAccountId: params.accountId,
          nudgeUserId: params.userId,
          nudgeRole: params.role,
        },
      });
      return { clerkInvitationId: invitation.id };
    } catch (err) {
      this.logger.error({
        msg: "Clerk createOrganizationInvitation failed",
        event: "clerk_org_invitation_error",
        organizationId: params.organizationId,
        accountId: params.accountId,
        userId: params.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async revokeInvitation(params: RevokeInvitationParams): Promise<void> {
    try {
      await this.client.organizations.revokeOrganizationInvitation({
        organizationId: params.organizationId,
        invitationId: params.clerkInvitationId,
      });
    } catch (err) {
      this.logger.error({
        msg: "Clerk revokeOrganizationInvitation failed",
        event: "clerk_org_invitation_revoke_error",
        organizationId: params.organizationId,
        clerkInvitationId: params.clerkInvitationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
