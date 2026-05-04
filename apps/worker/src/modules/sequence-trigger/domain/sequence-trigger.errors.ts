export class NoActiveSequenceError extends Error {
  constructor(
    public readonly customerId: string,
    public readonly businessId: string,
  ) {
    super(`No sequence configured for customer ${customerId} in business ${businessId}`);
    this.name = "NoActiveSequenceError";
  }
}

export class NoStepsError extends Error {
  constructor(public readonly sequenceId: string) {
    super(`Sequence ${sequenceId} has no steps`);
    this.name = "NoStepsError";
  }
}
