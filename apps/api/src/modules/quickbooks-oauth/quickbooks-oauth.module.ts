import { Module } from "@nestjs/common";
import { QuickbooksOAuthController } from "./quickbooks-oauth.controller";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";
import { QuickbooksOAuthProvider } from "./domain/quickbooks-oauth.provider";

@Module({
  controllers: [QuickbooksOAuthController],
  providers: [QuickbooksOAuthService, QuickbooksOAuthProvider],
  exports: [QuickbooksOAuthProvider],
})
export class QuickbooksOAuthModule {}
