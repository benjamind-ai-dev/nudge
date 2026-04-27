import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  XeroConnectionLookup,
  XeroConnectionLookupResult,
} from "../domain/xero-connection-lookup.repository";

@Injectable()
export class PrismaXeroConnectionLookupRepository
  implements XeroConnectionLookup
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByTenantId(
    tenantId: string,
  ): Promise<XeroConnectionLookupResult | null> {
    const row = await this.prisma.connection.findFirst({
      where: { provider: "xero", realmId: tenantId },
      select: { id: true, businessId: true, status: true },
    });
    if (!row) return null;
    return {
      connectionId: row.id,
      businessId: row.businessId,
      status: row.status,
    };
  }
}
