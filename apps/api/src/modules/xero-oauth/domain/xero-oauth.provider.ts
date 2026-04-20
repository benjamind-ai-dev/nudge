import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { XeroClient } from "xero-node";
import { Env } from "../../../common/config/env.schema";
import {
  OAuthProvider,
  ProviderMetadata,
  ProviderName,
  ProviderTokens,
} from "../../connections-common/domain/oauth-provider";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
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
      redirectUris: [this.config.get("XERO_REDIRECT_URI", { infer: true })],
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
    await xero.updateTenants();
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
