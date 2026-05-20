export class RelationshipTierNotFoundError extends Error {
  constructor(public readonly tierId: string) {
    super(`RelationshipTier ${tierId} not found`);
    this.name = "RelationshipTierNotFoundError";
  }
}

export class TierNameAlreadyExistsError extends Error {
  constructor(
    public readonly name: string,
    public readonly businessId: string,
  ) {
    super(`A tier named "${name}" already exists for business ${businessId}`);
    this.name = "TierNameAlreadyExistsError";
  }
}

export class TierLimitReachedError extends Error {
  constructor(
    public readonly businessId: string,
    public readonly limit: number,
  ) {
    super(`Maximum ${limit} tiers per business`);
    this.name = "TierLimitReachedError";
  }
}

export class CannotDeleteDefaultTierError extends Error {
  constructor(public readonly tierId: string) {
    super("Cannot delete the default tier. Set another tier as default first.");
    this.name = "CannotDeleteDefaultTierError";
  }
}

export class CannotDeleteTierWithActiveSequencesError extends Error {
  constructor(public readonly tierId: string) {
    super("Cannot delete tier with active sequences. Stop or reassign sequences first.");
    this.name = "CannotDeleteTierWithActiveSequencesError";
  }
}

export class BusinessHasNoDefaultTierError extends Error {
  constructor(public readonly businessId: string) {
    super(`Business ${businessId} has no default tier — cannot reassign customers`);
    this.name = "BusinessHasNoDefaultTierError";
  }
}
