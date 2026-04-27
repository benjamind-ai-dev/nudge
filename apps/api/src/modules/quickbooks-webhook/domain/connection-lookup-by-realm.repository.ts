import type { ProviderName } from "@nudge/connections-domain";

export const CONNECTION_LOOKUP_BY_REALM = Symbol(
  "CONNECTION_LOOKUP_BY_REALM",
);

export interface ConnectionLookupResult {
  connectionId: string;
  businessId: string;
  status: string;
}

export interface ConnectionLookupByRealm {
  findByRealm(
    provider: ProviderName,
    realmId: string,
  ): Promise<ConnectionLookupResult | null>;
}
