import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import {
  Connection,
  type ConnectionStatus,
  type PersistedConnection,
  type ProviderName,
} from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { Env } from "../../../common/config/env.schema";
import type { SyncConnectionReader } from "../domain/repositories";

type ConnectionRow = {
  id: string;
  businessId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  realmId: string | null;
  scopes: string | null;
  status: string;
  lastRefreshAt: Date | null;
  errorMessage: string | null;
  syncCursor: string | null;
};

@Injectable()
export class PrismaSyncConnectionReader implements SyncConnectionReader {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private key(): string {
    return this.config.get("ENCRYPTION_KEY", { infer: true });
  }

  private toDomain(row: ConnectionRow): Connection {
    const persisted: PersistedConnection = {
      id: row.id,
      businessId: row.businessId,
      provider: row.provider,
      encryptedAccessToken: row.accessToken,
      encryptedRefreshToken: row.refreshToken,
      tokenExpiresAt: row.tokenExpiresAt,
      externalTenantId: row.realmId,
      scopes: row.scopes,
      status: row.status,
      lastRefreshAt: row.lastRefreshAt,
      errorMessage: row.errorMessage,
    };
    const conn = Connection.fromPersistence(persisted, this.key());
    // syncCursor is not part of the shared Connection entity — attach it
    // here so the invoice-sync use case can read it. Readonly on the class
    // is compile-time only; at runtime these are plain properties.
    (conn as Connection & { syncCursor: string | null }).syncCursor =
      row.syncCursor;
    return conn;
  }

  async findAllSyncable(
    providerNames: readonly ProviderName[],
  ): Promise<Connection[]> {
    if (providerNames.length === 0) return [];
    const rows = await this.prisma.connection.findMany({
      where: {
        status: "connected" satisfies ConnectionStatus,
        provider: { in: [...providerNames] },
      },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Connection | null> {
    const row = await this.prisma.connection.findFirst({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async updateSyncCursor(id: string, cursor: Date): Promise<void> {
    await this.prisma.connection.update({
      where: { id },
      data: { syncCursor: cursor.toISOString() },
    });
  }
}
