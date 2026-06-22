import { DomainError } from "../../../common/errors/domain.error";

export class BusinessNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly businessId: string) {
    super(`Business ${businessId} not found`);
    this.name = "BusinessNotFoundError";
  }
}

export type InvalidStateReason = "missing" | "expired" | "provider_mismatch";

export class InvalidStateError extends DomainError {
  readonly httpStatus = 400;

  constructor(public readonly reason: InvalidStateReason) {
    super(`OAuth state invalid: ${reason}`);
    this.name = "InvalidStateError";
  }
}

export class TokenExchangeError extends DomainError {
  readonly httpStatus = 502;

  constructor(public readonly cause: unknown) {
    super("OAuth token exchange failed");
    this.name = "TokenExchangeError";
  }
}

export class TenantFetchError extends DomainError {
  readonly httpStatus = 502;

  constructor(public readonly cause: unknown) {
    super("Failed to fetch provider tenants");
    this.name = "TenantFetchError";
  }
}
