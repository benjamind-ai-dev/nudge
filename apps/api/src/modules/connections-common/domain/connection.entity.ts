import { encrypt, decrypt } from "@nudge/shared";
import { EncryptionError } from "./connection.errors";
import { ProviderName } from "./oauth-provider";

export type ConnectionStatus = "connected" | "error" | "disconnected";

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
      encryptionKey,
    );
  }

  get accessToken(): string {
    return decrypt(this.encryptedAccessToken, this.key);
  }

  get refreshToken(): string {
    return decrypt(this.encryptedRefreshToken, this.key);
  }
}
