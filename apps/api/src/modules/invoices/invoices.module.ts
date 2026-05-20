import { Module } from "@nestjs/common";
import { INVOICE_REPOSITORY } from "./domain/invoice.repository";
import { STRIPE_PAYMENT_LINK_SERVICE } from "./domain/stripe-payment-link.service";
import { PrismaInvoiceRepository } from "./infrastructure/prisma-invoice.repository";
import { StripePaymentLinkAdapter } from "./infrastructure/stripe-payment-link.service";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { GetInvoiceUseCase } from "./application/get-invoice.use-case";
import { CreatePaymentLinkUseCase } from "./application/create-payment-link.use-case";
import { InvoicesController } from "./invoices.controller";

@Module({
  controllers: [InvoicesController],
  providers: [
    ListInvoicesUseCase,
    GetInvoiceUseCase,
    CreatePaymentLinkUseCase,
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: STRIPE_PAYMENT_LINK_SERVICE, useClass: StripePaymentLinkAdapter },
  ],
})
export class InvoicesModule {}
