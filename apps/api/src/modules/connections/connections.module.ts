import { Module } from "@nestjs/common";
import { ConnectionsController } from "./connections.controller";
import { QuickbooksCallbackController } from "./quickbooks-callback.controller";
import { XeroCallbackController } from "./xero-callback.controller";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";

@Module({
  imports: [ConnectionsCommonModule],
  controllers: [
    ConnectionsController,
    QuickbooksCallbackController,
    XeroCallbackController,
  ],
})
export class ConnectionsModule {}
