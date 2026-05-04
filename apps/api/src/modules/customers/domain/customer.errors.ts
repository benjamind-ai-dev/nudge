export class CustomerNotFoundError extends Error {
  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}
