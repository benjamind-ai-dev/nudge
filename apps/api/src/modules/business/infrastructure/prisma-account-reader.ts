import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { AccountReader, AccountSummary } from "../domain/account-reader";

@Injectable()
export class PrismaAccountReader implements AccountReader {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findById(accountId: string): Promise<AccountSummary | null> {
    const row = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, email: true, maxBusinesses: true },
    });
    return row;
  }
}
