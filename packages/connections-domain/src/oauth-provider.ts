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
  // Best-effort token revocation. Implementations should call the upstream
  // OAuth revocation endpoint and resolve on success. Failures should throw —
  // the caller is responsible for deciding whether to swallow them.
  revokeTokens(refreshToken: string): Promise<void>;
}

export const OAUTH_PROVIDERS = Symbol("OAUTH_PROVIDERS");
export type OAuthProviderMap = Record<ProviderName, OAuthProvider>;
