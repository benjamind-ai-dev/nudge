import { Module } from "@nestjs/common";
import { InvoiceSyncModule } from "../invoice-sync/invoice-sync.module";
import { TokenRefreshModule } from "../token-refresh/token-refresh.module";
import { SyncSingleInvoiceUseCase } from "../invoice-sync/application/sync-single-invoice.use-case";
import { QuickbooksWebhookSyncProcessor } from "./infrastructure/quickbooks-webhook-sync.processor";

@Module({
  imports: [InvoiceSyncModule, TokenRefreshModule],
  providers: [SyncSingleInvoiceUseCase, QuickbooksWebhookSyncProcessor],
})
export class QuickbooksWebhookSyncModule {}
