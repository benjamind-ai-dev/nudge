import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_BILLING_REPOSITORY,
  type AccountBillingRepository,
} from "../domain/account-billing.repository";
import { AccountNotFoundError } from "../domain/stripe-events.errors";
import type {
  StripeInvoice,
  StripeEventEnvelope,
} from "../domain/stripe-event-payloads";

@Injectable()
export class HandlePaymentSucceededUseCase {
  private readonly logger = new Logger(HandlePaymentSucceededUseCase.name);

  constructor(
    @Inject(ACCOUNT_BILLING_REPOSITORY)
    private readonly accounts: AccountBillingRepository,
  ) {}

  async execute(payload: unknown): Promise<void> {
    const event = payload as StripeEventEnvelope<StripeInvoice>;
    const invoice = event.data.object;

    const customerId = invoice.customer;
    if (!customerId) {
      this.logger.warn({
        msg: "invoice.payment_succeeded missing customer ID",
        event: "stripe_payment_succeeded_no_customer",
        invoiceId: invoice.id,
      });
      return;
    }

    const account = await this.accounts.findByStripeCustomerId(customerId);
    if (!account) {
      throw new AccountNotFoundError(`stripe_customer:${customerId}`);
    }

    await this.accounts.updateBillingState(account.id, { status: "active" });

    this.logger.log({
      msg: "Account status set to active via invoice.payment_succeeded",
      event: "stripe_payment_succeeded",
      accountId: account.id,
      stripeCustomerId: customerId,
      invoiceId: invoice.id,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    });
  }
}
