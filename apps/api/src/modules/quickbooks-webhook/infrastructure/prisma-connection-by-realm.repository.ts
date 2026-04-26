import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import type { ProviderName } from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  ConnectionLookupByRealm,
  ConnectionLookupResult,
} from "../domain/connection-lookup-by-realm.repository";

@Injectable()
export class PrismaConnectionByRealmRepository
  implements ConnectionLookupByRealm
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByRealm(
    provider: ProviderName,
    realmId: string,
  ): Promise<ConnectionLookupResult | null> {
    const row = await this.prisma.connection.findFirst({
      where: { provider, realmId },
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
