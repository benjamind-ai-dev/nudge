import { Inject, Injectable } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepository } from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(businessId: string): Promise<Customer[]> {
    return this.repo.findAllByBusiness(businessId);
  }
}
