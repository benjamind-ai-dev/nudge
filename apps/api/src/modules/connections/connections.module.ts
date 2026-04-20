import { Module } from "@nestjs/common";
import { ConnectionsController } from "./connections.controller";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";

@Module({
  imports: [ConnectionsCommonModule],
  controllers: [ConnectionsController],
})
export class ConnectionsModule {}
