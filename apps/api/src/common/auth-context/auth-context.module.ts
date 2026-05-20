import { Global, Module } from "@nestjs/common";
import { CallerContextService } from "./caller-context.service";
import { CALLER_CONTEXT_REPOSITORY } from "./caller-context.types";
import { PrismaCallerContextRepository } from "./prisma-caller-context.repository";
import { BusinessAuthorizationService } from "./business-authorization.service";
import { BUSINESS_OWNERSHIP_REPOSITORY } from "./business-ownership.repository";
import { PrismaBusinessOwnershipRepository } from "./prisma-business-ownership.repository";

@Global()
@Module({
  providers: [
    CallerContextService,
    {
      provide: CALLER_CONTEXT_REPOSITORY,
      useClass: PrismaCallerContextRepository,
    },
    BusinessAuthorizationService,
    {
      provide: BUSINESS_OWNERSHIP_REPOSITORY,
      useClass: PrismaBusinessOwnershipRepository,
    },
  ],
  exports: [CallerContextService, BusinessAuthorizationService],
})
export class AuthContextModule {}
