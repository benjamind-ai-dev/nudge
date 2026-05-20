import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderMap,
} from "@nudge/connections-domain";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
} from "../domain/business.repository";
import {
  DISCONNECT_REPOSITORY,
  type DisconnectRepository,
} from "../domain/disconnect.repository";
import { BusinessNotFoundError } from "../domain/business.errors";

@Injectable()
export class DeleteBusinessUseCase {
  private readonly logger = new Logger(DeleteBusinessUseCase.name);

  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businesses: BusinessRepository,
    @Inject(DISCONNECT_REPOSITORY)
    private readonly disconnect: DisconnectRepository,
    @Inject(OAUTH_PROVIDERS)
    private readonly providers: OAuthProviderMap,
  ) {}

  async execute(id: string): Promise<void> {
    // Step 1 — verify the business exists. Outside any transaction.
    const existing = await this.businesses.findById(id);
    if (!existing) {
      throw new BusinessNotFoundError(id);
    }

    // Step 2 — load active connections (status='connected'). Outside any
    // transaction. Returns decrypted refresh tokens.
    const active = await this.disconnect.findActiveConnections(id);

    // Step 3 — best-effort revoke upstream. Network calls; failures are
    // logged but never block the local disconnect.
    for (const conn of active) {
      try {
        await this.providers[conn.provider].revokeTokens(conn.refreshToken);
        this.logger.log({
          msg: "Revoked OAuth tokens upstream",
          businessId: id,
          provider: conn.provider,
          connectionId: conn.id,
        });
      } catch (err) {
        // Don't throw — best-effort semantics.
        this.logger.warn({
          msg: "Upstream OAuth revoke failed (continuing with local disconnect)",
          businessId: id,
          provider: conn.provider,
          connectionId: conn.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Step 4 — single $transaction: stop runs + mark connections revoked +
    // soft-delete the business.
    const result = await this.disconnect.runDisconnect(id);

    this.logger.log({
      msg: "Business disconnected",
      businessId: id,
      stoppedRunCount: result.stoppedRunCount,
      revokedConnectionCount: result.revokedConnectionCount,
    });
  }
}
