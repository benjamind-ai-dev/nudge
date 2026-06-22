import { DomainError } from "../../../common/errors/domain.error";

export class CustomerNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}

export class TierBelongsToDifferentBusinessError extends DomainError {
  readonly httpStatus = 400;

  constructor(
    public readonly tierId: string,
    public readonly businessId: string,
  ) {
    super(`Relationship tier ${tierId} does not belong to business ${businessId}`);
    this.name = "TierBelongsToDifferentBusinessError";
  }
}

export class SequenceBelongsToDifferentBusinessError extends DomainError {
  readonly httpStatus = 400;

  constructor(
    public readonly sequenceId: string,
    public readonly businessId: string,
  ) {
    super(`Sequence ${sequenceId} does not belong to business ${businessId}`);
    this.name = "SequenceBelongsToDifferentBusinessError";
  }
}
