import { Module } from "@nestjs/common";
import { QuickbooksOAuthProvider } from "./domain/quickbooks-oauth.provider";

@Module({
  providers: [QuickbooksOAuthProvider],
  exports: [QuickbooksOAuthProvider],
})
export class QuickbooksOAuthModule {}
