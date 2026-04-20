import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  BusinessRepository,
  BusinessSummary,
} from "../domain/business.repository";

@Injectable()
export class PrismaBusinessRepository implements BusinessRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<BusinessSummary | null> {
    const row = await this.prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    return row ? { id: row.id } : null;
  }
}
