import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../domain/customer.repository";
import { TierBelongsToDifferentBusinessError } from "../domain/customer.errors";
import type { Customer } from "../domain/customer.entity";

@Injectable()
export class AssignCustomerTierUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(id: string, businessId: string, tierId: string | null): Promise<Customer> {
    if (tierId !== null) {
      const ok = await this.repo.tierBelongsToBusiness(tierId, businessId);
      if (!ok) throw new TierBelongsToDifferentBusinessError(tierId, businessId);
    }
    return this.repo.update(id, businessId, { relationshipTierId: tierId });
  }
}
