import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../domain/customer.repository";
import type { CustomerDetail } from "../domain/customer.entity";
import { CustomerNotFoundError } from "../domain/customer.errors";

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<CustomerDetail> {
    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new CustomerNotFoundError(id);
    return detail;
  }
}
