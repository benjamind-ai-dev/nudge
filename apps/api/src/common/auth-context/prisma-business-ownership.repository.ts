import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../database/database.module";
import type { BusinessOwnershipRepository } from "./business-ownership.repository";

@Injectable()
export class PrismaBusinessOwnershipRepository
  implements BusinessOwnershipRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async existsForAccount(
    businessId: string,
    accountId: string,
  ): Promise<boolean> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId, accountId },
      select: { id: true },
    });
    return row !== null;
  }
}
