import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from '@nestjs/common';
import Stripe from 'stripe';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateCheckoutUseCase } from './application/create-checkout.use-case';
import { CreatePortalUseCase } from './application/create-portal.use-case';
import { GetBillingStatusUseCase } from './application/get-billing-status.use-case';
import { AccountNotFoundError, NoStripeCustomerError } from './domain/billing.errors';
import { createCheckoutSchema, type CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('v1/billing')
export class BillingController {
  constructor(
    private readonly createCheckout: CreateCheckoutUseCase,
    private readonly createPortal: CreatePortalUseCase,
    private readonly getBillingStatus: GetBillingStatusUseCase,
  ) {}

  @Post('create-checkout')
  @HttpCode(200)
  async checkout(
    @AccountId() accountId: string,
    @Body(new ZodValidationPipe(createCheckoutSchema)) dto: CreateCheckoutDto,
  ) {
    try {
      const result = await this.createCheckout.execute(accountId, dto.plan);
      return { data: { checkout_url: result.checkoutUrl } };
    } catch (error) {
      if (error instanceof AccountNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(`Stripe: ${error.message}`);
      }
      throw error;
    }
  }

  @Post('create-portal')
  @HttpCode(200)
  async portal(@AccountId() accountId: string) {
    try {
      const result = await this.createPortal.execute(accountId);
      return { data: { portal_url: result.portalUrl } };
    } catch (error) {
      if (error instanceof AccountNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof NoStripeCustomerError) throw new BadRequestException(error.message);
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(`Stripe: ${error.message}`);
      }
      throw error;
    }
  }

  @Get('status')
  async status(@AccountId() accountId: string) {
    try {
      const result = await this.getBillingStatus.execute(accountId);
      return {
        data: {
          plan: result.plan,
          status: result.status,
          current_period_end: result.currentPeriodEnd,
          cancel_at_period_end: result.cancelAtPeriodEnd,
          trial_ends_at: result.trialEndsAt,
        },
      };
    } catch (error) {
      if (error instanceof AccountNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(`Stripe: ${error.message}`);
      }
      throw error;
    }
  }
}
