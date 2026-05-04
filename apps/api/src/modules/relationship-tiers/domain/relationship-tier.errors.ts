export class RelationshipTierNotFoundError extends Error {
  constructor(public readonly tierId: string) {
    super(`RelationshipTier ${tierId} not found`);
    this.name = "RelationshipTierNotFoundError";
  }
}
