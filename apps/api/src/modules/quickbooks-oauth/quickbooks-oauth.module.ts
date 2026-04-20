import { Module, forwardRef } from "@nestjs/common";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";
import { QuickbooksOAuthController } from "./quickbooks-oauth.controller";
import { QuickbooksOAuthProvider } from "./domain/quickbooks-oauth.provider";

@Module({
  imports: [forwardRef(() => ConnectionsCommonModule)],
  controllers: [QuickbooksOAuthController],
  providers: [QuickbooksOAuthProvider],
  exports: [QuickbooksOAuthProvider],
})
export class QuickbooksOAuthModule {}
