import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OAuthClient from "intuit-oauth";
import { Env } from "../../../common/config/env.schema";
import {
  type OAuthProvider,
  type ProviderMetadata,
  type ProviderName,
  type ProviderTokens,
  RefreshFailedError,
  RefreshTokenExpiredError,
  TokenRevokedError,
} from "@nudge/connections-domain";

const SCOPE = "com.intuit.quickbooks.accounting";

@Injectable()
export class QuickbooksOAuthProvider implements OAuthProvider {
  readonly name: ProviderName = "quickbooks";
  readonly scopes = SCOPE;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private client(): OAuthClient {
    return new OAuthClient({
      clientId: this.config.get("QUICKBOOKS_CLIENT_ID", { infer: true }),
      clientSecret: this.config.get("QUICKBOOKS_CLIENT_SECRET", {
        infer: true,
      }),
      environment: this.config.get("QUICKBOOKS_ENVIRONMENT", { infer: true }),
      redirectUri: this.config.get("QUICKBOOKS_REDIRECT_URI", { infer: true }),
    });
  }

  async buildAuthUrl(state: string): Promise<string> {
    return this.client().authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state,
    });
  }

  async exchangeCode(
    code: string,
    _state: string,
    metadata: ProviderMetadata,
  ): Promise<ProviderTokens> {
    const redirect = this.config.get("QUICKBOOKS_REDIRECT_URI", {
      infer: true,
    });
    const realmParam = metadata.realmId ?? "";
    const authResponse = await this.client().createToken(
      `${redirect}?code=${code}&realmId=${realmParam}`,
    );
    const json = authResponse.getJson() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
    };
  }

  async resolveTenantId(
    _tokens: ProviderTokens,
    metadata: ProviderMetadata,
  ): Promise<string> {
    if (!metadata.realmId) {
      throw new Error("QuickBooks callback missing realmId");
    }
    return metadata.realmId;
  }

  async refreshTokens(refreshToken: string): Promise<ProviderTokens> {
    try {
      const authResponse = await this.client().refreshUsingToken(refreshToken);
      const json = authResponse.getJson() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: new Date(Date.now() + json.expires_in * 1000),
      };
    } catch (err) {
      throw classifyQuickBooksRefreshError(err);
    }
  }
}

function classifyQuickBooksRefreshError(err: unknown): Error {
  const response = (
    err as {
      authResponse?: {
        response?: { status?: number };
        json?: { error?: string };
      };
    }
  )?.authResponse;
  const status = response?.response?.status;
  const body = response?.json;

  // Intuit returns HTTP 400 (not 401) with error="invalid_grant" when the
  // refresh token is no longer valid — covers both user-disconnect and
  // the 101-day natural expiry. Treat as revoked either way; both require
  // the user to reconnect and we can't distinguish them from the response.
  if (body?.error === "invalid_grant") {
    return new TokenRevokedError();
  }
  if (status === 401) {
    return new TokenRevokedError();
  }
  return new RefreshFailedError(err);
}
