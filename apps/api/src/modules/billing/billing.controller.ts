import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { AccountId } from '../../common/decorators/account-id.decorator';
import { CallerContextService } from '../../common/auth-context/caller-context.service';
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
    private readonly callerCtx: CallerContextService,
  ) {}

  private async resolveAccountId(clerkUserId: string): Promise<string> {
    const ctx = await this.callerCtx.resolve(clerkUserId);
    if (!ctx) throw new UnauthorizedException('Caller not provisioned');
    return ctx.accountId;
  }

  @Post('create-checkout')
  @HttpCode(200)
  async checkout(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createCheckoutSchema)) dto: CreateCheckoutDto,
  ) {
    const accountId = await this.resolveAccountId(clerkUserId);
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
  async portal(@AccountId() clerkUserId: string) {
    const accountId = await this.resolveAccountId(clerkUserId);
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
  async status(@AccountId() clerkUserId: string) {
    const accountId = await this.resolveAccountId(clerkUserId);
    try {
      const result = await this.getBillingStatus.execute(accountId);
      return {
        data: {
          plan: result.plan,
          status: result.status,
          current_period_end: result.currentPeriodEnd,
          cancel_at_period_end: result.cancelAtPeriodEnd,
          trial_ends_at: result.trialEndsAt,
          has_stripe_customer: result.hasStripeCustomer,
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
