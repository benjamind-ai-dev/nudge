export class EncryptionError extends Error {
  constructor(public readonly cause: unknown) {
    super("Failed to encrypt/decrypt connection tokens");
    this.name = "EncryptionError";
  }
}

export class RefreshFailedError extends Error {
  constructor(public readonly cause: unknown) {
    super("Token refresh failed transiently");
    this.name = "RefreshFailedError";
  }
}

export class TokenRevokedError extends Error {
  constructor() {
    super("Refresh token rejected by provider — user likely revoked access");
    this.name = "TokenRevokedError";
  }
}

export class RefreshTokenExpiredError extends Error {
  constructor() {
    super("Refresh token has expired; user must reconnect");
    this.name = "RefreshTokenExpiredError";
  }
}
