import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../common/config/env.schema";
import { ProcessQuickbooksWebhookUseCase } from "./application/process-quickbooks-webhook.use-case";
import { CONNECTION_LOOKUP_BY_REALM } from "./domain/connection-lookup-by-realm.repository";
import { PrismaConnectionByRealmRepository } from "./infrastructure/prisma-connection-by-realm.repository";
import { IntuitSignatureGuard } from "./infrastructure/intuit-signature.guard";
import {
  HmacIntuitSignatureVerifier,
  INTUIT_SIGNATURE_VERIFIER,
} from "./infrastructure/intuit-signature.verifier";
import { QuickbooksWebhookController } from "./quickbooks-webhook.controller";

@Module({
  controllers: [QuickbooksWebhookController],
  providers: [
    ProcessQuickbooksWebhookUseCase,
    IntuitSignatureGuard,
    {
      provide: CONNECTION_LOOKUP_BY_REALM,
      useClass: PrismaConnectionByRealmRepository,
    },
    {
      provide: INTUIT_SIGNATURE_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new HmacIntuitSignatureVerifier(
          config.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN", { infer: true }),
        ),
    },
  ],
})
export class QuickbooksWebhookModule {}
