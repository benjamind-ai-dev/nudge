import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { QuickbooksOAuthProvider } from "../quickbooks-oauth/domain/quickbooks-oauth.provider";
import { QuickbooksOAuthModule } from "../quickbooks-oauth/quickbooks-oauth.module";
import { XeroOAuthProvider } from "../xero-oauth/domain/xero-oauth.provider";
import { XeroOAuthModule } from "../xero-oauth/xero-oauth.module";
import { CompleteConnectionUseCase } from "./application/complete-connection.use-case";
import { StartConnectionUseCase } from "./application/start-connection.use-case";
import { BUSINESS_REPOSITORY } from "./domain/business.repository";
import { CONNECTION_REPOSITORY } from "./domain/connection.repository";
import {
  OAUTH_PROVIDERS,
  OAuthProviderMap,
} from "./domain/oauth-provider";
import { OAuthStateService } from "./domain/oauth-state.service";
import { PrismaBusinessRepository } from "./infrastructure/prisma-business.repository";
import { PrismaConnectionRepository } from "./infrastructure/prisma-connection.repository";

@Module({
  imports: [
    QuickbooksOAuthModule,
    XeroOAuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INVOICE_SYNC }),
  ],
  providers: [
    OAuthStateService,
    StartConnectionUseCase,
    CompleteConnectionUseCase,
    { provide: CONNECTION_REPOSITORY, useClass: PrismaConnectionRepository },
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    {
      provide: OAUTH_PROVIDERS,
      useFactory: (
        qb: QuickbooksOAuthProvider,
        xero: XeroOAuthProvider,
      ): OAuthProviderMap => ({ quickbooks: qb, xero }),
      inject: [QuickbooksOAuthProvider, XeroOAuthProvider],
    },
  ],
  exports: [
    StartConnectionUseCase,
    CompleteConnectionUseCase,
  ],
})
export class ConnectionsCommonModule {}
