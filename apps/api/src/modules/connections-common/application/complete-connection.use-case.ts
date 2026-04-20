import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, InvoiceSyncJobData } from "@nudge/shared";
import { Env } from "../../../common/config/env.schema";
import { Connection } from "../domain/connection.entity";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "../domain/connection.repository";
import {
  OAUTH_PROVIDERS,
  OAuthProviderMap,
  ProviderMetadata,
  ProviderName,
} from "../domain/oauth-provider";
import { OAuthStateService } from "../domain/oauth-state.service";

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  if (cause && typeof cause === "object") {
    const c = cause as Record<string, unknown>;
    const message = c.message ?? c.error_description ?? c.error;
    if (typeof message === "string") return message;
    try {
      return JSON.stringify(cause);
    } catch {
      return String(cause);
    }
  }
  return String(cause);
}

export interface CompleteConnectionInput {
  code: string;
  state: string;
  providerHint: ProviderName;
  providerMetadata: ProviderMetadata;
}

export interface CompleteConnectionOutput {
  redirectUrl: string;
}

@Injectable()
export class CompleteConnectionUseCase {
  private readonly logger = new Logger(CompleteConnectionUseCase.name);

  constructor(
    private readonly state: OAuthStateService,
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly invoiceSync: Queue<InvoiceSyncJobData>,
    private readonly config: ConfigService<Env, true>,
    @Inject(OAUTH_PROVIDERS) private readonly providers: OAuthProviderMap,
  ) {}

  private frontend(): string {
    return this.config.get("FRONTEND_URL", { infer: true });
  }
  private errUrl(reason: string): string {
    return `${this.frontend()}/onboarding/complete?status=error&reason=${reason}`;
  }
  private successUrl(): string {
    return `${this.frontend()}/onboarding/complete?status=success`;
  }

  async execute(
    input: CompleteConnectionInput,
  ): Promise<CompleteConnectionOutput> {
    const payload = await this.state.consume(input.state);
    if (!payload || payload.provider !== input.providerHint) {
      this.logger.warn({
        msg: "OAuth state invalid",
        providerHint: input.providerHint,
        matched: !!payload,
      });
      return { redirectUrl: this.errUrl("invalid_state") };
    }

    const provider = this.providers[payload.provider];
    let tokens;
    try {
      tokens = await provider.exchangeCode(
        input.code,
        input.state,
        input.providerMetadata,
      );
    } catch (cause) {
      const errorMessage = describeCause(cause);
      this.logger.error({
        msg: `Token exchange failed: ${errorMessage}`,
        businessId: payload.businessId,
        provider: payload.provider,
        errorMessage,
        causeType: typeof cause,
        causeConstructor: cause?.constructor?.name,
      });
      return { redirectUrl: this.errUrl("token_exchange_failed") };
    }

    let tenantId: string;
    try {
      tenantId = await provider.resolveTenantId(tokens, input.providerMetadata);
    } catch (cause) {
      const errorMessage = describeCause(cause);
      this.logger.error({
        msg: `Tenant fetch failed: ${errorMessage}`,
        businessId: payload.businessId,
        provider: payload.provider,
        errorMessage,
        causeType: typeof cause,
        causeConstructor: cause?.constructor?.name,
      });
      return { redirectUrl: this.errUrl("tenant_fetch_failed") };
    }

    try {
      const connection = Connection.create(
        {
          businessId: payload.businessId,
          provider: payload.provider,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          externalTenantId: tenantId,
          scopes: provider.scopes,
        },
        this.config.get("ENCRYPTION_KEY", { infer: true }),
      );
      const saved = await this.connections.upsertByBusinessAndProvider(
        connection,
      );
      await this.invoiceSync.add(QUEUE_NAMES.INVOICE_SYNC, {
        businessId: payload.businessId,
      });
      this.logger.log({
        msg: "Connection completed",
        businessId: payload.businessId,
        provider: payload.provider,
        connectionId: saved.id,
      });
      return { redirectUrl: this.successUrl() };
    } catch (cause) {
      const errorMessage = describeCause(cause);
      this.logger.error({
        msg: `Connection persist failed: ${errorMessage}`,
        businessId: payload.businessId,
        provider: payload.provider,
        errorMessage,
        causeType: typeof cause,
        causeConstructor: cause?.constructor?.name,
      });
      return { redirectUrl: this.errUrl("internal_error") };
    }
  }
}
