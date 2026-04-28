import { Module } from "@nestjs/common";
import { HandleCheckoutCompletedUseCase } from "./application/handle-checkout-completed.use-case";
import { HandlePaymentSucceededUseCase } from "./application/handle-payment-succeeded.use-case";
import { HandlePaymentFailedUseCase } from "./application/handle-payment-failed.use-case";
import { HandleSubscriptionUpdatedUseCase } from "./application/handle-subscription-updated.use-case";
import { HandleSubscriptionDeletedUseCase } from "./application/handle-subscription-deleted.use-case";
import { HandleGracePeriodCheckUseCase } from "./application/handle-grace-period-check.use-case";
import { ACCOUNT_BILLING_REPOSITORY } from "./domain/account-billing.repository";
import { PLAN_CONFIG_SERVICE } from "./domain/plan-config";
import { PrismaAccountBillingRepository } from "./infrastructure/prisma-account-billing.repository";
import { ConfigPlanConfigService } from "./infrastructure/config-plan-config.service";
import { StripeEventsProcessor } from "./stripe-events.processor";
import { EMAIL_SERVICE } from "../message-send/domain/email.service";
import { ResendEmailService } from "../message-send/infrastructure/resend-email.service";

@Module({
  providers: [
    StripeEventsProcessor,
    HandleCheckoutCompletedUseCase,
    HandlePaymentSucceededUseCase,
    HandlePaymentFailedUseCase,
    HandleSubscriptionUpdatedUseCase,
    HandleSubscriptionDeletedUseCase,
    HandleGracePeriodCheckUseCase,
    {
      provide: ACCOUNT_BILLING_REPOSITORY,
      useClass: PrismaAccountBillingRepository,
    },
    {
      provide: PLAN_CONFIG_SERVICE,
      useClass: ConfigPlanConfigService,
    },
    {
      provide: EMAIL_SERVICE,
      useClass: ResendEmailService,
    },
  ],
})
export class StripeEventsModule {}
