import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  BusinessForDispatch,
  BusinessTimezoneReader,
} from "../application/dispatch-weekly-summaries.use-case";

@Injectable()
export class PrismaBusinessTimezoneReader implements BusinessTimezoneReader {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async listAll(): Promise<BusinessForDispatch[]> {
    return this.prisma.business.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true },
    });
  }
}
