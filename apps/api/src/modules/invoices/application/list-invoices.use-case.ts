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
    limit: number;
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly repo: InvoiceRepository,
  ) {}

  async execute(filter: InvoiceListFilter): Promise<ListInvoicesResult> {
    const { items, total, nextCursor } = await this.repo.findManyByFilter(filter);
    return {
      data: items,
      pagination: {
        limit: filter.limit,
        total,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  }
}
