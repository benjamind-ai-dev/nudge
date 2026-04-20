export class BusinessNotFoundError extends Error {
  constructor(public readonly businessId: string) {
    super(`Business ${businessId} not found`);
    this.name = "BusinessNotFoundError";
  }
}

export type InvalidStateReason = "missing" | "expired" | "provider_mismatch";

export class InvalidStateError extends Error {
  constructor(public readonly reason: InvalidStateReason) {
    super(`OAuth state invalid: ${reason}`);
    this.name = "InvalidStateError";
  }
}

export class TokenExchangeError extends Error {
  constructor(public readonly cause: unknown) {
    super("OAuth token exchange failed");
    this.name = "TokenExchangeError";
  }
}

export class TenantFetchError extends Error {
  constructor(public readonly cause: unknown) {
    super("Failed to fetch provider tenants");
    this.name = "TenantFetchError";
  }
}

export class EncryptionError extends Error {
  constructor(public readonly cause: unknown) {
    super("Failed to encrypt/decrypt connection tokens");
    this.name = "EncryptionError";
  }
}
