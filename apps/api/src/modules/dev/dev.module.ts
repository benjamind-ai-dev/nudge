import { Module } from "@nestjs/common";
import { ClerkWebhookModule } from "../clerk-webhook/clerk-webhook.module";
import { UsersModule } from "../users/users.module";
import { DevController } from "./dev.controller";
import { DevKeyGuard } from "./infrastructure/dev-key.guard";
import { BackfillClerkOrgsUseCase } from "./application/backfill-clerk-orgs.use-case";
import { DEV_ACCOUNT_LISTING_REPOSITORY } from "./domain/dev-account-listing.repository";
import { PrismaDevAccountListingRepository } from "./infrastructure/prisma-dev-account-listing.repository";

@Module({
  imports: [ClerkWebhookModule, UsersModule],
  controllers: [DevController],
  providers: [
    DevKeyGuard,
    BackfillClerkOrgsUseCase,
    {
      provide: DEV_ACCOUNT_LISTING_REPOSITORY,
      useClass: PrismaDevAccountListingRepository,
    },
  ],
})
export class DevModule {}
