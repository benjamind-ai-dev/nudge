import { Module } from "@nestjs/common";
import { XeroOAuthProvider } from "./domain/xero-oauth.provider";

@Module({
  providers: [XeroOAuthProvider],
  exports: [XeroOAuthProvider],
})
export class XeroOAuthModule {}
