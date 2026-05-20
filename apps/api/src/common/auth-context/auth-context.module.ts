import { Global, Module } from "@nestjs/common";
import { CallerContextService } from "./caller-context.service";
import { CALLER_CONTEXT_REPOSITORY } from "./caller-context.types";
import { PrismaCallerContextRepository } from "./prisma-caller-context.repository";

@Global()
@Module({
  providers: [
    CallerContextService,
    {
      provide: CALLER_CONTEXT_REPOSITORY,
      useClass: PrismaCallerContextRepository,
    },
  ],
  exports: [CallerContextService],
})
export class AuthContextModule {}
