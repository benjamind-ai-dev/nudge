export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = "AccountNotFoundError";
  }
}

export class NoStripeCustomerError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} has no Stripe customer — subscribe first`);
    this.name = "NoStripeCustomerError";
  }
}

export class InvalidPlanError extends Error {
  constructor(plan: string) {
    super(`Unknown plan: ${plan}`);
    this.name = "InvalidPlanError";
  }
}
