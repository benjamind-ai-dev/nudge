import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import type { Env } from "../../../common/config/env.schema";
import type {
  ClerkOrganizationService as IClerkOrganizationService,
  CreateOrganizationParams,
  CreateOrganizationResult,
  CreateOrganizationInvitationParams,
  CreateOrganizationInvitationResult,
  RevokeOrganizationInvitationParams,
  DeleteOrganizationMembershipParams,
  CreateOrganizationMembershipParams,
} from "../domain/clerk-organization.service";

@Injectable()
export class ClerkOrganizationService implements IClerkOrganizationService {
  private readonly logger = new Logger(ClerkOrganizationService.name);
  private readonly client: ReturnType<typeof createClerkClient>;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = createClerkClient({
      secretKey: this.config.get("CLERK_SECRET_KEY", { infer: true }),
    });
  }

  async createOrganization(
    p: CreateOrganizationParams,
  ): Promise<CreateOrganizationResult> {
    try {
      const org = await this.client.organizations.createOrganization({
        name: p.name,
        createdBy: p.ownerClerkUserId,
      });
      return { clerkOrganizationId: org.id };
    } catch (err) {
      this.logger.error({
        msg: "Clerk createOrganization failed",
        event: "clerk_org_create_error",
        name: p.name,
        ownerClerkUserId: p.ownerClerkUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async createOrganizationInvitation(
    p: CreateOrganizationInvitationParams,
  ): Promise<CreateOrganizationInvitationResult> {
    try {
      const inv = await this.client.organizations.createOrganizationInvitation({
        organizationId: p.organizationId,
        // Clerk SDK expects `string | undefined`, not `string | null`
        inviterUserId: p.inviterClerkUserId ?? undefined,
        emailAddress: p.email,
        role: p.role,
        publicMetadata: p.publicMetadata,
      });
      return { clerkInvitationId: inv.id };
    } catch (err) {
      this.logger.error({
        msg: "Clerk createOrganizationInvitation failed",
        event: "clerk_org_invite_create_error",
        organizationId: p.organizationId,
        accountId: p.publicMetadata.nudgeAccountId,
        userId: p.publicMetadata.nudgeUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async revokeOrganizationInvitation(
    p: RevokeOrganizationInvitationParams,
  ): Promise<void> {
    try {
      await this.client.organizations.revokeOrganizationInvitation({
        organizationId: p.organizationId,
        invitationId: p.clerkInvitationId,
      });
    } catch (err) {
      this.logger.error({
        msg: "Clerk revokeOrganizationInvitation failed",
        event: "clerk_org_invite_revoke_error",
        organizationId: p.organizationId,
        clerkInvitationId: p.clerkInvitationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async deleteOrganizationMembership(
    p: DeleteOrganizationMembershipParams,
  ): Promise<void> {
    try {
      await this.client.organizations.deleteOrganizationMembership({
        organizationId: p.organizationId,
        userId: p.clerkUserId,
      });
    } catch (err) {
      this.logger.error({
        msg: "Clerk deleteOrganizationMembership failed",
        event: "clerk_org_membership_delete_error",
        organizationId: p.organizationId,
        clerkUserId: p.clerkUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async createOrganizationMembership(
    p: CreateOrganizationMembershipParams,
  ): Promise<void> {
    try {
      await this.client.organizations.createOrganizationMembership({
        organizationId: p.organizationId,
        userId: p.clerkUserId,
        role: p.role,
      });
    } catch (err) {
      this.logger.error({
        msg: "Clerk createOrganizationMembership failed",
        event: "clerk_org_membership_create_error",
        organizationId: p.organizationId,
        clerkUserId: p.clerkUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
