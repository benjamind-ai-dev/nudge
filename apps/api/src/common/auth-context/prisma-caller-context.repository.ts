import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../database/database.module";
import { CallerContextRepository } from "./caller-context.types";

@Injectable()
export class PrismaCallerContextRepository implements CallerContextRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByClerkUserId(clerkUserId: string): Promise<{
    userId: string;
    accountId: string;
    role: string;
  } | null> {
    const row = await this.prisma.user.findFirst({
      where: { clerkUserId },
      select: { id: true, accountId: true, role: true },
    });
    if (!row) return null;
    return {
      userId: row.id,
      accountId: row.accountId,
      role: row.role,
    };
  }
}
