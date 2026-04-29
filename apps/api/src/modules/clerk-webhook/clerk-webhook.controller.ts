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
import { ClerkWebhookGuard, CLERK_EVENT_KEY } from "./infrastructure/clerk-webhook.guard";
import {
  clerkUserCreatedDataSchema,
  clerkWebhookEventSchema,
} from "./domain/clerk-webhook-payload";

type ClerkRequest = RawBodyRequest<Request> & Record<string, unknown>;

@Controller("v1/webhooks/clerk")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly provisionAccount: ProvisionAccountUseCase) {}

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
      const userParsed = clerkUserCreatedDataSchema.safeParse(data);
      if (!userParsed.success) {
        throw new BadRequestException("Malformed Clerk user.created payload");
      }

      const userData = userParsed.data;
      const primary = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      );

      if (!primary?.email_address) {
        throw new BadRequestException("Clerk user has no primary email address");
      }

      const email = primary.email_address;
      const name = [userData.first_name, userData.last_name]
        .filter(Boolean)
        .join(" ");

      await this.provisionAccount.execute(userData.id, email, name);

      this.logger.log({
        msg: "Account provisioned for new Clerk user",
        event: "clerk_user_provisioned",
        clerkId: userData.id,
      });
    }
  }
}
