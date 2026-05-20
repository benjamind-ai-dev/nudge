import { Inject, Injectable } from "@nestjs/common";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../domain/invoice.repository";
import type { InvoiceDetail } from "../domain/invoice.entity";
import { InvoiceNotFoundError } from "../domain/invoice.errors";

@Injectable()
export class GetInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly repo: InvoiceRepository,
  ) {}

  async execute(id: string, businessId: string): Promise<InvoiceDetail> {
    const detail = await this.repo.findDetailById(id, businessId);
    if (!detail) throw new InvoiceNotFoundError(id);
    return detail;
  }
}
