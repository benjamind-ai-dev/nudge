import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { DevAccountListingRepository } from "../domain/dev-account-listing.repository";

@Injectable()
export class PrismaDevAccountListingRepository
  implements DevAccountListingRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async listAccountsMissingClerkOrg(): Promise<string[]> {
    const rows = await this.prisma.account.findMany({
      where: { clerkOrganizationId: null, clerkId: { not: null } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => r.id);
  }
}
