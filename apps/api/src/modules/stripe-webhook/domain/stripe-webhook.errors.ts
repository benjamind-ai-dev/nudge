export class DuplicateStripeEventError extends Error {
  constructor(eventId: string) {
    super(`Stripe event ${eventId} already processed`);
    this.name = "DuplicateStripeEventError";
  }
}

export class InvalidStripeSignatureError extends Error {
  constructor() {
    super("Stripe webhook signature verification failed");
    this.name = "InvalidStripeSignatureError";
  }
}
