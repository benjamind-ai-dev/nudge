export class AccountNotFoundError extends Error {
  constructor(lookup: string) {
    super(`No account found for Stripe lookup: ${lookup}`);
    this.name = "AccountNotFoundError";
  }
}

export class UnknownPriceIdError extends Error {
  constructor(priceId: string) {
    super(`Price ID ${priceId} is not mapped to any plan`);
    this.name = "UnknownPriceIdError";
  }
}
