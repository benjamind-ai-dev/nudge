import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { TokenRefreshModule } from "../token-refresh/token-refresh.module";
import { EnqueueBusinessSyncsUseCase } from "./application/enqueue-business-syncs.use-case";
import { SyncBusinessInvoicesUseCase } from "./application/sync-business-invoices.use-case";
import {
  INVOICE_SYNC_PROVIDERS,
  type InvoiceSyncProviderMap,
} from "./domain/invoice-sync.provider";
import {
  CUSTOMER_REPOSITORY,
  INVOICE_REPOSITORY,
  SYNC_CONNECTION_READER,
} from "./domain/repositories";
import { InvoiceSyncProcessor } from "./infrastructure/invoice-sync.processor";
import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { PrismaInvoiceRepository } from "./infrastructure/prisma-invoice.repository";
import { PrismaSyncConnectionReader } from "./infrastructure/prisma-sync-connection.reader";
import { QuickbooksInvoiceSyncProvider } from "./infrastructure/quickbooks-invoice-sync.provider";

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.INVOICE_SYNC }),
    TokenRefreshModule,
  ],
  providers: [
    QuickbooksInvoiceSyncProvider,
    EnqueueBusinessSyncsUseCase,
    SyncBusinessInvoicesUseCase,
    InvoiceSyncProcessor,
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: SYNC_CONNECTION_READER, useClass: PrismaSyncConnectionReader },
    {
      provide: INVOICE_SYNC_PROVIDERS,
      useFactory: (qb: QuickbooksInvoiceSyncProvider): InvoiceSyncProviderMap => ({
        quickbooks: qb,
      }),
      inject: [QuickbooksInvoiceSyncProvider],
    },
  ],
})
export class InvoiceSyncModule {}
