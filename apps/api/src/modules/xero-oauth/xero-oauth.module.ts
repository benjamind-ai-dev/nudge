import { Module, forwardRef } from "@nestjs/common";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";
import { XeroOAuthController } from "./xero-oauth.controller";
import { XeroOAuthProvider } from "./domain/xero-oauth.provider";

@Module({
  imports: [forwardRef(() => ConnectionsCommonModule)],
  controllers: [XeroOAuthController],
  providers: [XeroOAuthProvider],
  exports: [XeroOAuthProvider],
})
export class XeroOAuthModule {}
