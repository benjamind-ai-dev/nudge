import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../common/config/env.schema";
import { ProcessXeroWebhookUseCase } from "./application/process-xero-webhook.use-case";
import { XERO_CONNECTION_LOOKUP } from "./domain/xero-connection-lookup.repository";
import { PrismaXeroConnectionLookupRepository } from "./infrastructure/prisma-xero-connection-lookup.repository";
import { XeroSignatureGuard } from "./infrastructure/xero-signature.guard";
import {
  HmacXeroSignatureVerifier,
  XERO_SIGNATURE_VERIFIER,
} from "./infrastructure/xero-signature.verifier";
import { XeroWebhookController } from "./xero-webhook.controller";

@Module({
  controllers: [XeroWebhookController],
  providers: [
    ProcessXeroWebhookUseCase,
    XeroSignatureGuard,
    {
      provide: XERO_CONNECTION_LOOKUP,
      useClass: PrismaXeroConnectionLookupRepository,
    },
    {
      provide: XERO_SIGNATURE_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new HmacXeroSignatureVerifier(
          config.get("XERO_WEBHOOK_KEY", { infer: true }),
        ),
    },
  ],
})
export class XeroWebhookModule {}
