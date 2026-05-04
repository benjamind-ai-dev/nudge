import { Module } from "@nestjs/common";
import { INVOICE_REPOSITORY } from "./domain/invoice.repository";
import { PrismaInvoiceRepository } from "./infrastructure/prisma-invoice.repository";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { InvoicesController } from "./invoices.controller";

@Module({
  controllers: [InvoicesController],
  providers: [
    ListInvoicesUseCase,
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
  ],
})
export class InvoicesModule {}
