import { Inject, Injectable } from "@nestjs/common";
import {
  INVOICE_REPOSITORY,
  type InvoiceListFilter,
  type InvoiceRepository,
} from "../domain/invoice.repository";
import type { InvoiceListItem } from "../domain/invoice.entity";

export interface ListInvoicesResult {
  data: InvoiceListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly repo: InvoiceRepository,
  ) {}

  async execute(filter: InvoiceListFilter): Promise<ListInvoicesResult> {
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
