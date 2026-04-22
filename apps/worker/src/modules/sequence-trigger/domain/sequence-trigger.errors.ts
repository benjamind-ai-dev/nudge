export class NoActiveSequenceError extends Error {
  constructor(
    public readonly tierId: string,
    public readonly tierName: string,
    public readonly businessId: string,
  ) {
    super(`No active sequence for tier "${tierName}" (${tierId}), business ${businessId}`);
    this.name = "NoActiveSequenceError";
  }
}

export class NoTierError extends Error {
  constructor(
    public readonly customerId: string,
    public readonly businessId: string,
  ) {
    super(`Customer ${customerId} has no tier and business ${businessId} has no default tier`);
    this.name = "NoTierError";
  }
}
