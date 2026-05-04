import { Inject, Injectable } from "@nestjs/common";
import { INVOICE_REPOSITORY, type InvoiceRepository } from "../domain/invoice.repository";
import type { Invoice } from "../domain/invoice.entity";

@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly repo: InvoiceRepository,
  ) {}

  async execute(businessId: string): Promise<Invoice[]> {
    return this.repo.findAllByBusiness(businessId);
  }
}
