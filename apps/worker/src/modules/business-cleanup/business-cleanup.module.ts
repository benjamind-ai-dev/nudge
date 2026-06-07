// apps/worker/src/modules/business-cleanup/business-cleanup.module.ts
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { CleanupStaleBusinessesUseCase } from "./application/cleanup-stale-businesses.use-case";
import { PrismaBusinessCleanupRepository } from "./infrastructure/prisma-business-cleanup.repository";
import { BusinessCleanupProcessor } from "./infrastructure/business-cleanup.processor";
import { BUSINESS_CLEANUP_REPOSITORY } from "./domain/business-cleanup.repository";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.BUSINESS_CLEANUP })],
  providers: [
    CleanupStaleBusinessesUseCase,
    BusinessCleanupProcessor,
    { provide: BUSINESS_CLEANUP_REPOSITORY, useClass: PrismaBusinessCleanupRepository },
  ],
})
export class BusinessCleanupModule {}
