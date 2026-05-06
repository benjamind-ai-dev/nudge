import { Module } from "@nestjs/common";
import { DevController } from "./dev.controller";
import { DevKeyGuard } from "./infrastructure/dev-key.guard";

@Module({
  controllers: [DevController],
  providers: [DevKeyGuard],
})
export class DevModule {}
