import { encrypt, decrypt } from "@nudge/shared";
import { EncryptionError } from "./connection.errors";
import { ProviderName } from "./oauth-provider";

export type ConnectionStatus = "connected" | "revoked" | "expired" | "error";

export interface ConnectionProps {
  businessId: string;
  provider: ProviderName;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  externalTenantId: string;
  scopes: string;
}

export interface PersistedConnection {
  id: string;
  businessId: string;
  provider: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date;
  externalTenantId: string | null;
  scopes: string | null;
  status: string;
  lastRefreshAt: Date | null;
  errorMessage: string | null;
}

export class Connection {
  private constructor(
    public readonly id: string | null,
    public readonly businessId: string,
    public readonly provider: ProviderName,
    public readonly encryptedAccessToken: string,
    public readonly encryptedRefreshToken: string,
    public readonly tokenExpiresAt: Date,
    public readonly externalTenantId: string,
    public readonly scopes: string,
    public readonly status: ConnectionStatus,
    public readonly lastRefreshAt: Date | null,
    public readonly errorMessage: string | null,
    private readonly key: string,
  ) {}

  static create(props: ConnectionProps, encryptionKey: string): Connection {
    try {
      const encAccess = encrypt(props.accessToken, encryptionKey);
      const encRefresh = encrypt(props.refreshToken, encryptionKey);
      return new Connection(
        null,
        props.businessId,
        props.provider,
        encAccess,
        encRefresh,
        props.tokenExpiresAt,
        props.externalTenantId,
        props.scopes,
        "connected",
        null,
        null,
        encryptionKey,
      );
    } catch (cause) {
      throw new EncryptionError(cause);
    }
  }

  static fromPersistence(
    row: PersistedConnection,
    encryptionKey: string,
  ): Connection {
    try {
      decrypt(row.encryptedAccessToken, encryptionKey);
      decrypt(row.encryptedRefreshToken, encryptionKey);
    } catch (cause) {
      throw new EncryptionError(cause);
    }
    return new Connection(
      row.id,
      row.businessId,
      row.provider as ProviderName,
      row.encryptedAccessToken,
      row.encryptedRefreshToken,
      row.tokenExpiresAt,
      row.externalTenantId ?? "",
      row.scopes ?? "",
      (row.status as ConnectionStatus) ?? "connected",
      row.lastRefreshAt,
      row.errorMessage,
      encryptionKey,
    );
  }

  get accessToken(): string {
    return decrypt(this.encryptedAccessToken, this.key);
  }

  get refreshToken(): string {
    return decrypt(this.encryptedRefreshToken, this.key);
  }

  rotateTokens(
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date,
  ): Connection {
    try {
      const encAccess = encrypt(accessToken, this.key);
      const encRefresh = encrypt(refreshToken, this.key);
      return new Connection(
        this.id,
        this.businessId,
        this.provider,
        encAccess,
        encRefresh,
        tokenExpiresAt,
        this.externalTenantId,
        this.scopes,
        "connected",
        new Date(),
        null,
        this.key,
      );
    } catch (cause) {
      throw new EncryptionError(cause);
    }
  }

  markRevoked(reason: string): Connection {
    return this.withStatus("revoked", reason);
  }

  markExpired(reason: string): Connection {
    return this.withStatus("expired", reason);
  }

  markError(reason: string): Connection {
    return this.withStatus("error", reason);
  }

  private withStatus(status: ConnectionStatus, reason: string): Connection {
    return new Connection(
      this.id,
      this.businessId,
      this.provider,
      this.encryptedAccessToken,
      this.encryptedRefreshToken,
      this.tokenExpiresAt,
      this.externalTenantId,
      this.scopes,
      status,
      this.lastRefreshAt,
      reason,
      this.key,
    );
  }
}
