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
      const invitation = await this.client.invitations.createInvitation({
        emailAddress: params.email,
        publicMetadata: {
          nudgeAccountId: params.accountId,
          nudgeUserId: params.userId,
          nudgeRole: params.role,
        },
      });
      return { clerkInvitationId: invitation.id };
    } catch (err) {
      this.logger.error({
        msg: "Clerk createInvitation failed",
        event: "clerk_invitation_error",
        accountId: params.accountId,
        userId: params.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async revokeInvitation(params: RevokeInvitationParams): Promise<void> {
    try {
      // The Clerk Backend SDK v3 revokeInvitation() takes a plain string invitationId.
      // The docs show an object form but the actual .d.ts is revokeInvitation(invitationId: string).
      await this.client.invitations.revokeInvitation(params.clerkInvitationId);
    } catch (err) {
      this.logger.error({
        msg: "Clerk revokeInvitation failed",
        event: "clerk_invitation_revoke_error",
        clerkInvitationId: params.clerkInvitationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
