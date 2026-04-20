import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { XeroClient } from "xero-node";
import { Env } from "../../../common/config/env.schema";
import {
  type OAuthProvider,
  type ProviderMetadata,
  type ProviderName,
  type ProviderTokens,
  RefreshFailedError,
  TokenRevokedError,
} from "@nudge/connections-domain";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.invoices",
  "accounting.contacts",
  "offline_access",
];

@Injectable()
export class XeroOAuthProvider implements OAuthProvider {
  readonly name: ProviderName = "xero";
  readonly scopes = SCOPES.join(" ");

  private readonly logger = new Logger(XeroOAuthProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private async client(state: string): Promise<XeroClient> {
    const xero = new XeroClient({
      clientId: this.config.get("XERO_CLIENT_ID", { infer: true }),
      clientSecret: this.config.get("XERO_CLIENT_SECRET", { infer: true }),
      redirectUris: [this.config.get("XERO_REDIRECT_URI", { infer: true }) ?? ""],
      scopes: SCOPES,
      state,
    });
    await xero.initialize();
    return xero;
  }

  async buildAuthUrl(state: string): Promise<string> {
    const xero = await this.client(state);
    return xero.buildConsentUrl();
  }

  async exchangeCode(
    code: string,
    state: string,
    _metadata: ProviderMetadata,
  ): Promise<ProviderTokens> {
    const xero = await this.client(state);
    const redirect = this.config.get("XERO_REDIRECT_URI", { infer: true });
    const callbackUrl = `${redirect}?code=${code}&state=${state}`;
    const tokenSet = (await xero.apiCallback(callbackUrl)) as {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      expires_in?: number;
    };

    const expiresAt = tokenSet.expires_at
      ? new Date(tokenSet.expires_at * 1000)
      : new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000);

    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt,
    };
  }

  async refreshTokens(refreshToken: string): Promise<ProviderTokens> {
    try {
      const xero = await this.client("");
      const tokenSet = (await xero.refreshWithRefreshToken(
        this.config.get("XERO_CLIENT_ID", { infer: true }),
        this.config.get("XERO_CLIENT_SECRET", { infer: true }),
        refreshToken,
      )) as {
        access_token: string;
        refresh_token: string;
        expires_at?: number;
        expires_in?: number;
      };

      const expiresAt = tokenSet.expires_at
        ? new Date(tokenSet.expires_at * 1000)
        : new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000);

      return {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt,
      };
    } catch (err) {
      throw classifyXeroRefreshError(err);
    }
  }

  async resolveTenantId(
    tokens: ProviderTokens,
    _metadata: ProviderMetadata,
  ): Promise<string> {
    const xero = await this.client("");
    await xero.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(tokens.expiresAt.getTime() / 1000),
      token_type: "Bearer",
    });
    // `false` skips the /api.xro/2.0/Organisation call xero-node otherwise
    // makes per tenant — that endpoint needs the accounting.settings scope,
    // which we don't request. /connections alone gives us tenantId.
    await xero.updateTenants(false);
    const list = xero.tenants;
    if (!list || list.length === 0) {
      throw new Error("Xero returned no tenants");
    }
    if (list.length > 1) {
      this.logger.warn({
        msg: "Xero connection returned multiple tenants",
        tenantCount: list.length,
      });
    }
    return list[0].tenantId;
  }
}

function classifyXeroRefreshError(err: unknown): Error {
  const response = (
    err as { response?: { statusCode?: number; body?: { error?: string } } }
  )?.response;
  const status = response?.statusCode;
  const body = response?.body;

  // invalid_grant covers both user-disconnect and refresh-token expiry —
  // Xero doesn't distinguish in the response. Treat as revoked since both
  // require the user to reconnect and "revoked" is the more common cause
  // at MVP scale (the 60-day natural expiry is rare in active use).
  if (body?.error === "invalid_grant") {
    return new TokenRevokedError();
  }
  if (status === 401) {
    return new TokenRevokedError();
  }
  return new RefreshFailedError(err);
}
