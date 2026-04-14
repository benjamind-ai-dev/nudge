import { Module } from "@nestjs/common";
import { DebugProcessor } from "./debug.processor";

@Module({
  providers: [DebugProcessor],
})
export class DebugModule {}
