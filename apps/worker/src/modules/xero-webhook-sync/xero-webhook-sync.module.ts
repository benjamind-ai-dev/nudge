import { Module } from "@nestjs/common";
import { InvoiceSyncModule } from "../invoice-sync/invoice-sync.module";
import { TokenRefreshModule } from "../token-refresh/token-refresh.module";
import { SyncSingleXeroInvoiceUseCase } from "./application/sync-single-xero-invoice.use-case";
import { XeroWebhookSyncProcessor } from "./infrastructure/xero-webhook-sync.processor";

@Module({
  imports: [InvoiceSyncModule, TokenRefreshModule],
  providers: [SyncSingleXeroInvoiceUseCase, XeroWebhookSyncProcessor],
})
export class XeroWebhookSyncModule {}
