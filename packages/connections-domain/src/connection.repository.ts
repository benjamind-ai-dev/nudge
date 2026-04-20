import { Connection, ConnectionStatus } from "./connection.entity";
import { ProviderName, ProviderTokens } from "./oauth-provider";

export const CONNECTION_REPOSITORY = Symbol("CONNECTION_REPOSITORY");

export type RefreshOutcome =
  | { kind: "refreshed"; connection: Connection }
  | { kind: "skipped"; reason: "lock_held" | "status_changed" }
  | { kind: "failed"; error: Error };

export interface ConnectionRepository {
  upsertByBusinessAndProvider(connection: Connection): Promise<Connection>;
  findByBusinessAndProvider(
    businessId: string,
    provider: ProviderName,
  ): Promise<Connection | null>;
  findById(id: string): Promise<Connection | null>;
  findDueForRefresh(expiringBefore: Date): Promise<Connection[]>;
  updateStatus(
    id: string,
    status: ConnectionStatus,
    errorMessage: string,
  ): Promise<void>;
  refreshConnection(
    connectionId: string,
    refreshOp: (currentRefreshToken: string) => Promise<ProviderTokens>,
  ): Promise<RefreshOutcome>;
}
