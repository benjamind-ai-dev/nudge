import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../database/database.module";
import type {
  BusinessOwnership,
  BusinessOwnershipRepository,
} from "./business-ownership.repository";

@Injectable()
export class PrismaBusinessOwnershipRepository
  implements BusinessOwnershipRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findForAccount(
    businessId: string,
    accountId: string,
  ): Promise<BusinessOwnership | null> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId, accountId },
      select: { isActive: true, account: { select: { status: true } } },
    });
    if (!row) return null;
    return { isActive: row.isActive, accountStatus: row.account.status };
  }
}
