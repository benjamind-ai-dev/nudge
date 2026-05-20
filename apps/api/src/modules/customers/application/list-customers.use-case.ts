import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  type CustomerListFilter,
  type CustomerRepository,
} from "../domain/customer.repository";
import type { Customer } from "../domain/customer.entity";

export interface ListCustomersResult {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: CustomerRepository,
  ) {}

  async execute(filter: CustomerListFilter): Promise<ListCustomersResult> {
    const { items, total } = await this.repo.findManyByFilter(filter);
    const totalPages = Math.max(1, Math.ceil(total / filter.limit));
    return {
      data: items,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages,
      },
    };
  }
}
