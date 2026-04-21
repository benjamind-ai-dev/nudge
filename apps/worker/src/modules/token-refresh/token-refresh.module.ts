import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import {
  CONNECTION_REPOSITORY,
  OAUTH_PROVIDERS,
  OAuthProviderMap,
} from "@nudge/connections-domain";
import { EnqueueRefreshJobsUseCase } from "./application/enqueue-refresh-jobs.use-case";
import { RefreshTokenUseCase } from "./application/refresh-token.use-case";
import { PrismaConnectionRepository } from "./infrastructure/prisma-connection.repository";
import { QuickbooksOAuthProvider } from "./infrastructure/quickbooks-oauth.provider";
import { TokenRefreshProcessor } from "./infrastructure/token-refresh.processor";
import { XeroOAuthProvider } from "./infrastructure/xero-oauth.provider";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.TOKEN_REFRESH })],
  providers: [
    QuickbooksOAuthProvider,
    XeroOAuthProvider,
    EnqueueRefreshJobsUseCase,
    RefreshTokenUseCase,
    TokenRefreshProcessor,
    { provide: CONNECTION_REPOSITORY, useClass: PrismaConnectionRepository },
    {
      provide: OAUTH_PROVIDERS,
      useFactory: (
        qb: QuickbooksOAuthProvider,
        xero: XeroOAuthProvider,
      ): OAuthProviderMap => ({ quickbooks: qb, xero }),
      inject: [QuickbooksOAuthProvider, XeroOAuthProvider],
    },
  ],
  exports: [RefreshTokenUseCase],
})
export class TokenRefreshModule {}
