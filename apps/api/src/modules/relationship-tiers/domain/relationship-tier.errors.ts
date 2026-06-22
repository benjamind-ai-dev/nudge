import { DomainError } from "../../../common/errors/domain.error";

export class RelationshipTierNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly tierId: string) {
    super(`RelationshipTier ${tierId} not found`);
    this.name = "RelationshipTierNotFoundError";
  }
}

export class TierNameAlreadyExistsError extends DomainError {
  readonly httpStatus = 400;

  constructor(
    public readonly name: string,
    public readonly businessId: string,
  ) {
    super(`A tier named "${name}" already exists for business ${businessId}`);
    this.name = "TierNameAlreadyExistsError";
  }
}

export class TierLimitReachedError extends DomainError {
  readonly httpStatus = 400;

  constructor(
    public readonly businessId: string,
    public readonly limit: number,
  ) {
    super(`Maximum ${limit} tiers per business`);
    this.name = "TierLimitReachedError";
  }
}

export class CannotDeleteDefaultTierError extends DomainError {
  readonly httpStatus = 400;

  constructor(public readonly tierId: string) {
    super("Cannot delete the default tier. Set another tier as default first.");
    this.name = "CannotDeleteDefaultTierError";
  }
}

export class CannotDeleteTierWithActiveSequencesError extends DomainError {
  readonly httpStatus = 400;

  constructor(public readonly tierId: string) {
    super("Cannot delete tier with active sequences. Stop or reassign sequences first.");
    this.name = "CannotDeleteTierWithActiveSequencesError";
  }
}

export class BusinessHasNoDefaultTierError extends DomainError {
  readonly httpStatus = 500;

  constructor(public readonly businessId: string) {
    super(`Business ${businessId} has no default tier — cannot reassign customers`);
    this.name = "BusinessHasNoDefaultTierError";
  }
}
