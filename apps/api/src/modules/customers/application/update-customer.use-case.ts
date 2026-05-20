import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
  type UpdateCustomerData,
} from "../domain/customer.repository";
import {
  SequenceBelongsToDifferentBusinessError,
  TierBelongsToDifferentBusinessError,
} from "../domain/customer.errors";
import type { Customer } from "../domain/customer.entity";

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer> {
    if (data.relationshipTierId !== undefined && data.relationshipTierId !== null) {
      const ok = await this.repo.tierBelongsToBusiness(data.relationshipTierId, businessId);
      if (!ok) {
        throw new TierBelongsToDifferentBusinessError(data.relationshipTierId, businessId);
      }
    }
    if (data.sequenceId !== undefined && data.sequenceId !== null) {
      const ok = await this.repo.sequenceBelongsToBusiness(data.sequenceId, businessId);
      if (!ok) {
        throw new SequenceBelongsToDifferentBusinessError(data.sequenceId, businessId);
      }
    }
    return this.repo.update(id, businessId, data);
  }
}
