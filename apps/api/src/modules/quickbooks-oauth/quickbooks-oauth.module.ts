import { Module } from "@nestjs/common";
import { QuickbooksOAuthController } from "./quickbooks-oauth.controller";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";

@Module({
  controllers: [QuickbooksOAuthController],
  providers: [QuickbooksOAuthService],
})
export class QuickbooksOAuthModule {}
