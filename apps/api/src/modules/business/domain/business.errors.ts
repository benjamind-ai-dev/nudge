import { DomainError } from "../../../common/errors/domain.error";

export class BusinessNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(id: string) {
    super(`Business ${id} not found`);
    this.name = "BusinessNotFoundError";
  }
}

export class NoActiveConnectionError extends DomainError {
  readonly httpStatus = 409;

  constructor(businessId: string) {
    super(`Business ${businessId} has no active accounting connection`);
    this.name = "NoActiveConnectionError";
  }
}

export class SyncRateLimitedError extends DomainError {
  readonly httpStatus = 429;

  constructor(
    businessId: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      `Sync for business ${businessId} rate-limited; retry in ${retryAfterSeconds}s`,
    );
    this.name = "SyncRateLimitedError";
  }
}

export class BusinessLimitReachedError extends DomainError {
  readonly httpStatus = 409;

  constructor(accountId: string, max: number) {
    super(`Account ${accountId} has reached its business limit of ${max}`);
    this.name = "BusinessLimitReachedError";
  }
}

export class AccountNotFoundError extends DomainError {
  readonly httpStatus = 401;

  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}
