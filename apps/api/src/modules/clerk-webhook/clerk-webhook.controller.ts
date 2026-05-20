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
import type { Request } from "express";
import { ProvisionAccountUseCase } from "./application/provision-account.use-case";
import { LinkInvitedUserUseCase } from "./application/link-invited-user.use-case";
import { ClerkWebhookGuard, CLERK_EVENT_KEY } from "./infrastructure/clerk-webhook.guard";
import {
  clerkUserCreatedDataSchema,
  clerkWebhookEventSchema,
  nudgeInvitationMetadataSchema,
} from "./domain/clerk-webhook-payload";
import { PendingUserNotFoundError } from "../users/domain/user.errors";

type ClerkRequest = RawBodyRequest<Request> & Record<string, unknown>;

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
    if (type !== "user.created") return;

    const userParsed = clerkUserCreatedDataSchema.safeParse(data);
    if (!userParsed.success) {
      throw new BadRequestException("Malformed Clerk user.created payload");
    }
    const userData = userParsed.data;

    // Branch on invitation metadata.
    const metadataParsed = nudgeInvitationMetadataSchema.safeParse(userData.public_metadata);
    if (metadataParsed.success) {
      try {
        await this.linkInvitedUser.execute({
          nudgeAccountId: metadataParsed.data.nudgeAccountId,
          nudgeUserId: metadataParsed.data.nudgeUserId,
          clerkUserId: userData.id,
        });
        this.logger.log({
          msg: "Invited user linked",
          event: "clerk_invited_user_linked",
          clerkId: userData.id,
          accountId: metadataParsed.data.nudgeAccountId,
          userId: metadataParsed.data.nudgeUserId,
        });
      } catch (err) {
        if (err instanceof PendingUserNotFoundError) {
          // Clerk retries 4xx forever; we log and ack to avoid infinite retries.
          this.logger.error({
            msg: "Pending user row not found for invitation acceptance — acking webhook",
            event: "clerk_link_pending_not_found",
            clerkId: userData.id,
            accountId: metadataParsed.data.nudgeAccountId,
            userId: metadataParsed.data.nudgeUserId,
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
  }
}
