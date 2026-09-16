import { DomainError } from "../errors/domain.error";

export class CallerNotProvisionedError extends DomainError {
  readonly httpStatus = 401;

  constructor(clerkUserId: string) {
    super(`No provisioned user row for clerk session ${clerkUserId}`);
    this.name = "CallerNotProvisionedError";
  }
}

/**
 * The caller owns the business, but the account is not paid (`status` is not
 * `active`). Business-scoped endpoints refuse; billing endpoints stay open so
 * the user can subscribe. The web `BillingGate` redirects to the paywall.
 */
export class AccountNotEntitledError extends DomainError {
  readonly httpStatus = 402;

  constructor(accountStatus: string) {
    super(`Account is not entitled (billing status: ${accountStatus})`);
    this.name = "AccountNotEntitledError";
  }
}
