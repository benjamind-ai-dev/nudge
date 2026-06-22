import { Module } from "@nestjs/common";
import { INVOICE_REPOSITORY } from "./domain/invoice.repository";
import { STRIPE_PAYMENT_LINK_SERVICE } from "./domain/stripe-payment-link.service";
import { START_FOLLOW_UP_REPOSITORY } from "./domain/start-follow-up.repository";
import { PrismaInvoiceRepository } from "./infrastructure/prisma-invoice.repository";
import { StripePaymentLinkAdapter } from "./infrastructure/stripe-payment-link.service";
import { PrismaStartFollowUpRepository } from "./infrastructure/prisma-start-follow-up.repository";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { GetInvoiceUseCase } from "./application/get-invoice.use-case";
import { CreatePaymentLinkUseCase } from "./application/create-payment-link.use-case";
import { StartFollowUpUseCase } from "./application/start-follow-up.use-case";
import { InvoicesController } from "./invoices.controller";

@Module({
  controllers: [InvoicesController],
  providers: [
    ListInvoicesUseCase,
    GetInvoiceUseCase,
    CreatePaymentLinkUseCase,
    StartFollowUpUseCase,
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: STRIPE_PAYMENT_LINK_SERVICE, useClass: StripePaymentLinkAdapter },
    { provide: START_FOLLOW_UP_REPOSITORY, useClass: PrismaStartFollowUpRepository },
  ],
})
export class InvoicesModule {}
