// apps/worker/src/modules/business-cleanup/infrastructure/prisma-business-cleanup.repository.ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { BusinessCleanupRepository } from "../domain/business-cleanup.repository";

@Injectable()
export class PrismaBusinessCleanupRepository implements BusinessCleanupRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async deactivateStale(cutoff: Date): Promise<number> {
    const result = await this.prisma.business.updateMany({
      where: {
        isActive: true,
        createdAt: { lt: cutoff },
        connections: { none: {} },
      },
      data: { isActive: false },
    });
    return result.count;
  }
}
