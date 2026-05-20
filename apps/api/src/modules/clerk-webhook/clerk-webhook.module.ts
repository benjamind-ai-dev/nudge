import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database/database.module";
import { UsersModule } from "../users/users.module";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ClerkWebhookGuard } from "./infrastructure/clerk-webhook.guard";
import { ProvisionAccountUseCase } from "./application/provision-account.use-case";
import { LinkInvitedUserUseCase } from "./application/link-invited-user.use-case";
import { PrismaAccountProvisionRepository } from "./infrastructure/prisma-account-provision.repository";
import { ACCOUNT_PROVISION_REPOSITORY } from "./domain/account-provision.repository";

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [ClerkWebhookController],
  providers: [
    ClerkWebhookGuard,
    ProvisionAccountUseCase,
    LinkInvitedUserUseCase,
    {
      provide: ACCOUNT_PROVISION_REPOSITORY,
      useClass: PrismaAccountProvisionRepository,
    },
  ],
})
export class ClerkWebhookModule {}
