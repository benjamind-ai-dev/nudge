export type ProviderName = "quickbooks" | "xero";

export interface ProviderTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ProviderMetadata {
  realmId?: string;
}

export interface OAuthProvider {
  readonly name: ProviderName;
  readonly scopes: string;

  buildAuthUrl(state: string): Promise<string>;
  exchangeCode(
    code: string,
    state: string,
    metadata: ProviderMetadata,
  ): Promise<ProviderTokens>;
  resolveTenantId(
    tokens: ProviderTokens,
    metadata: ProviderMetadata,
  ): Promise<string>;
  refreshTokens(refreshToken: string): Promise<ProviderTokens>;
}

export const OAUTH_PROVIDERS = Symbol("OAUTH_PROVIDERS");
export type OAuthProviderMap = Record<ProviderName, OAuthProvider>;
