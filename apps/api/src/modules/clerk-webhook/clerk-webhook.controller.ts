import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { ProvisionAccountUseCase } from "./application/provision-account.use-case";
import { LinkInvitedUserUseCase } from "./application/link-invited-user.use-case";
import { ClerkWebhookGuard, CLERK_EVENT_KEY } from "./infrastructure/clerk-webhook.guard";
import {
  clerkOrgMembershipCreatedDataSchema,
  clerkUserCreatedDataSchema,
  clerkWebhookEventSchema,
  nudgeInvitationMetadataSchema,
} from "./domain/clerk-webhook-payload";
import { PendingUserNotFoundError } from "../users/domain/user.errors";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "../../common/throttler/throttler-config";

type ClerkRequest = RawBodyRequest<Request> & Record<string, unknown>;

@SkipThrottle({ [RATE_LIMIT_NAMES.DEFAULT]: true, [RATE_LIMIT_NAMES.AUTH]: true })
@Throttle({ [RATE_LIMIT_NAMES.WEBHOOKS]: RATE_LIMITS.WEBHOOKS })
@Controller("v1/webhooks/clerk")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly provisionAccount: ProvisionAccountUseCase,
    private readonly linkInvitedUser: LinkInvitedUserUseCase,
  ) {}

  @Post()
  @UseGuards(ClerkWebhookGuard)
  @HttpCode(200)
  async handle(@Req() req: ClerkRequest): Promise<void> {
    const parsed = clerkWebhookEventSchema.safeParse(req[CLERK_EVENT_KEY]);
    if (!parsed.success) {
      throw new BadRequestException("Malformed Clerk webhook event");
    }

    const { type, data } = parsed.data;

    if (type === "user.created") {
      // Account provisioning for fresh signups. If user.created carries nudge
      // invitation metadata (legacy global-invitation path or stragglers), still
      // link. Going forward most invites go through organizationMembership.created.
      const userParsed = clerkUserCreatedDataSchema.safeParse(data);
      if (!userParsed.success) {
        throw new BadRequestException("Malformed Clerk user.created payload");
      }
      const userData = userParsed.data;

      const legacyMeta = nudgeInvitationMetadataSchema.safeParse(userData.public_metadata);
      if (legacyMeta.success) {
        try {
          await this.linkInvitedUser.execute({
            nudgeAccountId: legacyMeta.data.nudgeAccountId,
            nudgeUserId: legacyMeta.data.nudgeUserId,
            clerkUserId: userData.id,
          });
          this.logger.log({
            msg: "Invited user linked (legacy user.created path)",
            event: "clerk_invited_user_linked_legacy",
            clerkId: userData.id,
            accountId: legacyMeta.data.nudgeAccountId,
            userId: legacyMeta.data.nudgeUserId,
          });
        } catch (err) {
          if (err instanceof PendingUserNotFoundError) {
            // Clerk retries 4xx forever; we log and ack to avoid infinite retries.
            this.logger.error({
              msg: "Pending user row not found for invitation acceptance (legacy user.created path) — acking webhook",
              event: "clerk_link_pending_not_found_legacy",
              clerkId: userData.id,
            });
            return;
          }
          throw err;
        }
        return;
      }

      // Fresh signup — no invitation metadata.
      const primary = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      );
      if (!primary?.email_address) {
        throw new BadRequestException("Clerk user has no primary email address");
      }
      const email = primary.email_address;
      const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ");

      await this.provisionAccount.execute(userData.id, email, name);
      this.logger.log({
        msg: "Account provisioned for new Clerk user",
        event: "clerk_user_provisioned",
        clerkId: userData.id,
      });
      return;
    }

    if (type === "organizationMembership.created") {
      const dataParsed = clerkOrgMembershipCreatedDataSchema.safeParse(data);
      if (!dataParsed.success) {
        throw new BadRequestException("Malformed organizationMembership.created payload");
      }
      const meta = nudgeInvitationMetadataSchema.safeParse(dataParsed.data.public_metadata);
      if (!meta.success) {
        // Org member added outside our invitation flow (e.g., owner's own membership
        // created when the org is created) — ignore.
        this.logger.log({
          msg: "Ignoring organizationMembership.created with no Nudge metadata",
          event: "clerk_membership_ignored_no_meta",
          organizationId: dataParsed.data.organization.id,
          clerkUserId: dataParsed.data.public_user_data.user_id,
        });
        return;
      }
      try {
        await this.linkInvitedUser.execute({
          nudgeAccountId: meta.data.nudgeAccountId,
          nudgeUserId: meta.data.nudgeUserId,
          clerkUserId: dataParsed.data.public_user_data.user_id,
        });
        this.logger.log({
          msg: "Invited user linked from organizationMembership.created",
          event: "clerk_membership_linked",
          organizationId: dataParsed.data.organization.id,
          clerkUserId: dataParsed.data.public_user_data.user_id,
          accountId: meta.data.nudgeAccountId,
          userId: meta.data.nudgeUserId,
        });
      } catch (err) {
        if (err instanceof PendingUserNotFoundError) {
          this.logger.error({
            msg: "Pending user not found for org membership accept — acking",
            event: "clerk_membership_pending_not_found",
            organizationId: dataParsed.data.organization.id,
            clerkUserId: dataParsed.data.public_user_data.user_id,
          });
          return;
        }
        throw err;
      }
      return;
    }

    // Unknown event types — ack and ignore.
  }
}
