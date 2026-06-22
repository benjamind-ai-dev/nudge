import { DomainError } from "../../../common/errors/domain.error";

export class AccountNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}

export class NoStripeCustomerError extends DomainError {
  readonly httpStatus = 400;

  constructor(accountId: string) {
    super(`Account ${accountId} has no Stripe customer — subscribe first`);
    this.name = "NoStripeCustomerError";
  }
}

export class InvalidPlanError extends DomainError {
  readonly httpStatus = 400;

  constructor(plan: string) {
    super(`Unknown plan: ${plan}`);
    this.name = "InvalidPlanError";
  }
}
