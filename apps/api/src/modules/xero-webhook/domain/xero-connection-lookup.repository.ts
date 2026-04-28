export const XERO_CONNECTION_LOOKUP = Symbol("XERO_CONNECTION_LOOKUP");

export interface XeroConnectionLookupResult {
  connectionId: string;
  businessId: string;
  status: string;
}

export interface XeroConnectionLookup {
  findByTenantId(
    tenantId: string,
  ): Promise<XeroConnectionLookupResult | null>;
}
