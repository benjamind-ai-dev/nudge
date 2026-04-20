import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import {
  Connection,
  type ConnectionRepository,
  type ConnectionStatus,
  type PersistedConnection,
  type ProviderName,
  type ProviderTokens,
  type RefreshOutcome,
} from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { Env } from "../../../common/config/env.schema";

@Injectable()
export class PrismaConnectionRepository implements ConnectionRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private key(): string {
    return this.config.get("ENCRYPTION_KEY", { infer: true });
  }

  private toDomain(row: {
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
  }): Connection {
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
    return Connection.fromPersistence(persisted, this.key());
  }

  async upsertByBusinessAndProvider(
    _connection: Connection,
  ): Promise<Connection> {
    throw new Error("upsertByBusinessAndProvider is API-only");
  }

  async findByBusinessAndProvider(
    businessId: string,
    provider: ProviderName,
  ): Promise<Connection | null> {
    const row = await this.prisma.connection.findFirst({
      where: { businessId, provider },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(id: string): Promise<Connection | null> {
    const row = await this.prisma.connection.findFirst({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findDueForRefresh(expiringBefore: Date): Promise<Connection[]> {
    const rows = await this.prisma.connection.findMany({
      where: { status: "connected", tokenExpiresAt: { lt: expiringBefore } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async updateStatus(
    id: string,
    status: ConnectionStatus,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.connection.update({
      where: { id },
      data: { status, errorMessage },
    });
  }

  async refreshConnection(
    connectionId: string,
    refreshOp: (currentRefreshToken: string) => Promise<ProviderTokens>,
  ): Promise<RefreshOutcome> {
    return this.prisma
      .$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${connectionId}, 0)) AS locked
        `;
        if (!locked[0]?.locked) {
          return { kind: "skipped", reason: "lock_held" } as const;
        }

        const row = await tx.connection.findFirst({
          where: { id: connectionId, status: "connected" },
        });
        if (!row) {
          return { kind: "skipped", reason: "status_changed" } as const;
        }

        const conn = this.toDomain(row);
        const newTokens = await refreshOp(conn.refreshToken);
        const updated = conn.rotateTokens(
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresAt,
        );
        await tx.connection.update({
          where: { id: connectionId },
          data: {
            accessToken: updated.encryptedAccessToken,
            refreshToken: updated.encryptedRefreshToken,
            tokenExpiresAt: updated.tokenExpiresAt,
            lastRefreshAt: updated.lastRefreshAt ?? new Date(),
            errorMessage: null,
          },
        });
        return { kind: "refreshed", connection: updated } as const;
      })
      .catch((error: Error) => ({ kind: "failed", error }) as const);
  }
}
