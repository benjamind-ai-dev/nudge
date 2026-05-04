import { Inject, Injectable } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepository, type UpdateCustomerData } from "../domain/customer.repository";
import { CustomerNotFoundError } from "../domain/customer.errors";
import type { Customer } from "../domain/customer.entity";

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(id: string, businessId: string, data: UpdateCustomerData): Promise<Customer> {
    try {
      return await this.repo.update(id, businessId, data);
    } catch (error) {
      if (error instanceof CustomerNotFoundError) throw error;
      throw error;
    }
  }
}
