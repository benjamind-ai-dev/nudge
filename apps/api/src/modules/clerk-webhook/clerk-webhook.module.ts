import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/database/database.module";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ClerkWebhookGuard } from "./infrastructure/clerk-webhook.guard";
import { ProvisionAccountUseCase } from "./application/provision-account.use-case";
import { PrismaAccountProvisionRepository } from "./infrastructure/prisma-account-provision.repository";
import { ACCOUNT_PROVISION_REPOSITORY } from "./domain/account-provision.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [ClerkWebhookController],
  providers: [
    ClerkWebhookGuard,
    ProvisionAccountUseCase,
    {
      provide: ACCOUNT_PROVISION_REPOSITORY,
      useClass: PrismaAccountProvisionRepository,
    },
  ],
})
export class ClerkWebhookModule {}
