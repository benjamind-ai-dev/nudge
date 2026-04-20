import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
  OAUTH_PROVIDERS,
  OAuthProviderMap,
  ProviderName,
  ProviderTokens,
  RefreshFailedError,
  RefreshTokenExpiredError,
  TokenRevokedError,
} from "@nudge/connections-domain";

const ACK_REPLAY_WINDOW_MS = 60_000;

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connections: ConnectionRepository,
    @Inject(OAUTH_PROVIDERS)
    private readonly providers: OAuthProviderMap,
  ) {}

  async execute(connectionId: string): Promise<void> {
    const conn = await this.connections.findById(connectionId);
    if (!conn) {
      this.logger.warn({
        msg: "Refresh target not found",
        event: "refresh_skipped",
        connectionId,
      });
      return;
    }
    const provider = this.providers[conn.provider];

    const outcome = await this.connections.refreshConnection(
      connectionId,
      async (rt): Promise<ProviderTokens> => provider.refreshTokens(rt),
    );

    if (outcome.kind === "refreshed") {
      this.logger.log({
        msg: "Token refreshed",
        event: "refresh_success",
        connectionId,
        businessId: outcome.connection.businessId,
        provider: outcome.connection.provider,
        newExpiry: outcome.connection.tokenExpiresAt?.toISOString(),
      });
      return;
    }

    if (outcome.kind === "skipped") {
      this.logger.log({
        msg: "Refresh skipped",
        event: "refresh_skipped",
        connectionId,
        reason: outcome.reason,
      });
      return;
    }

    await this.handleError(connectionId, conn.provider, outcome.error);
  }

  private async handleError(
    connectionId: string,
    provider: ProviderName,
    err: Error,
  ): Promise<void> {
    if (err instanceof TokenRevokedError) {
      const current = await this.connections.findById(connectionId);
      const recent =
        current?.lastRefreshAt != null &&
        Date.now() - current.lastRefreshAt.getTime() < ACK_REPLAY_WINDOW_MS;
      if (recent) {
        this.logger.warn({
          msg: "Revoked 401 within ack-replay window; treating as success",
          event: "refresh_ack_replay_ignored",
          connectionId,
          provider,
        });
        return;
      }
      await this.connections.updateStatus(connectionId, "revoked", "User revoked access");
      this.logger.warn({
        msg: "Token revoked by user",
        event: "refresh_revoked",
        connectionId,
        provider,
        errorType: "TokenRevokedError",
      });
      throw new UnrecoverableError("TokenRevokedError");
    }

    if (err instanceof RefreshTokenExpiredError) {
      await this.connections.updateStatus(
        connectionId,
        "expired",
        "Refresh token expired, reconnect required",
      );
      this.logger.warn({
        msg: "Refresh token expired",
        event: "refresh_expired",
        connectionId,
        provider,
        errorType: "RefreshTokenExpiredError",
      });
      throw new UnrecoverableError("RefreshTokenExpiredError");
    }

    if (err instanceof RefreshFailedError) {
      this.logger.warn({
        msg: "Transient refresh failure",
        event: "refresh_transient_error",
        connectionId,
        provider,
        errorType: "RefreshFailedError",
        errorMessage: truncate(err.message, 500),
      });
      throw err;
    }

    this.logger.error({
      msg: "Unknown refresh error",
      event: "refresh_transient_error",
      connectionId,
      provider,
      errorType: err.name,
      errorMessage: truncate(err.message, 500),
    });
    throw err;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
