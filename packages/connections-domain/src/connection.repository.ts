import { Connection } from "./connection.entity";
import { ProviderName } from "./oauth-provider";

export const CONNECTION_REPOSITORY = Symbol("CONNECTION_REPOSITORY");

export interface ConnectionRepository {
  upsertByBusinessAndProvider(connection: Connection): Promise<Connection>;
  findByBusinessAndProvider(
    businessId: string,
    provider: ProviderName,
  ): Promise<Connection | null>;
}
