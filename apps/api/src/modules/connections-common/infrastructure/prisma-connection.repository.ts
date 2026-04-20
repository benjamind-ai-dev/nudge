import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { Env } from "../../../common/config/env.schema";
import {
  Connection,
  type ConnectionRepository,
  type ProviderName,
} from "@nudge/connections-domain";

@Injectable()
export class PrismaConnectionRepository implements ConnectionRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private key(): string {
    return this.config.get("ENCRYPTION_KEY", { infer: true });
  }

  async upsertByBusinessAndProvider(
    connection: Connection,
  ): Promise<Connection> {
    const row = await this.prisma.connection.upsert({
      where: {
        businessId_provider: {
          businessId: connection.businessId,
          provider: connection.provider,
        },
      },
      create: {
        businessId: connection.businessId,
        provider: connection.provider,
        accessToken: connection.encryptedAccessToken,
        refreshToken: connection.encryptedRefreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
        realmId: connection.externalTenantId,
        scopes: connection.scopes,
        status: connection.status,
      },
      update: {
        accessToken: connection.encryptedAccessToken,
        refreshToken: connection.encryptedRefreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
        realmId: connection.externalTenantId,
        scopes: connection.scopes,
        status: connection.status,
        errorMessage: null,
      },
    });
    return Connection.fromPersistence(
      {
        id: row.id,
        businessId: row.businessId,
        provider: row.provider,
        encryptedAccessToken: row.accessToken,
        encryptedRefreshToken: row.refreshToken,
        tokenExpiresAt: row.tokenExpiresAt,
        externalTenantId: row.realmId,
        scopes: row.scopes,
        status: row.status,
      },
      this.key(),
    );
  }

  async findByBusinessAndProvider(
    businessId: string,
    provider: ProviderName,
  ): Promise<Connection | null> {
    const row = await this.prisma.connection.findFirst({
      where: { businessId, provider },
    });
    if (!row) return null;
    return Connection.fromPersistence(
      {
        id: row.id,
        businessId: row.businessId,
        provider: row.provider,
        encryptedAccessToken: row.accessToken,
        encryptedRefreshToken: row.refreshToken,
        tokenExpiresAt: row.tokenExpiresAt,
        externalTenantId: row.realmId,
        scopes: row.scopes,
        status: row.status,
      },
      this.key(),
    );
  }
}
