export class CustomerNotFoundError extends Error {
  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}

export class TierBelongsToDifferentBusinessError extends Error {
  constructor(
    public readonly tierId: string,
    public readonly businessId: string,
  ) {
    super(`Relationship tier ${tierId} does not belong to business ${businessId}`);
    this.name = "TierBelongsToDifferentBusinessError";
  }
}

export class SequenceBelongsToDifferentBusinessError extends Error {
  constructor(
    public readonly sequenceId: string,
    public readonly businessId: string,
  ) {
    super(`Sequence ${sequenceId} does not belong to business ${businessId}`);
    this.name = "SequenceBelongsToDifferentBusinessError";
  }
}
