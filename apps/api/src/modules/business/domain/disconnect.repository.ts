import type { ProviderName } from "@nudge/connections-domain";

export const DISCONNECT_REPOSITORY = Symbol("DISCONNECT_REPOSITORY");

export interface BusinessActiveConnection {
  // Connection PK — used only for logging in the use case.
  id: string;
  provider: ProviderName;
  // Decrypted refresh token, ready to pass to OAuthProvider.revokeTokens.
  // The repo owns decryption (it has the encryption key via ConfigService).
  refreshToken: string;
}

export interface DisconnectResult {
  // Number of sequence_runs rows whose status flipped to "stopped".
  stoppedRunCount: number;
  // Number of connections rows whose status flipped to "revoked".
  revokedConnectionCount: number;
}

export interface DisconnectRepository {
  // Returns connections with status='connected' for the business.
  // Tokens are decrypted. Empty array if none.
  findActiveConnections(businessId: string): Promise<BusinessActiveConnection[]>;

  // Performs the three writes in a single $transaction:
  //   1. sequence_runs: stop all active/paused runs for the business.
  //   2. connections: mark all status='connected' rows as 'revoked' with
  //      errorMessage='manually_disconnected'.
  //   3. businesses: set isActive=false.
  // Returns counts for logging. Idempotent — re-running on an already
  // disconnected business returns zero counts and is a no-op for businesses.
  runDisconnect(businessId: string): Promise<DisconnectResult>;
}
