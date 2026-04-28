import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { CreateCheckoutUseCase } from './application/create-checkout.use-case';
import { CreatePortalUseCase } from './application/create-portal.use-case';
import { GetBillingStatusUseCase } from './application/get-billing-status.use-case';
import { BILLING_REPOSITORY } from './domain/billing.repository';
import { STRIPE_SERVICE } from './domain/stripe.service';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository';
import { StripeBillingService } from './infrastructure/stripe-billing.service';

@Module({
  controllers: [BillingController],
  providers: [
    CreateCheckoutUseCase,
    CreatePortalUseCase,
    GetBillingStatusUseCase,
    {
      provide: BILLING_REPOSITORY,
      useClass: PrismaBillingRepository,
    },
    {
      provide: STRIPE_SERVICE,
      useClass: StripeBillingService,
    },
  ],
})
export class BillingModule {}
