import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../domain/invoice.repository";
import {
  STRIPE_PAYMENT_LINK_SERVICE,
  type StripePaymentLinkService,
} from "../domain/stripe-payment-link.service";
import {
  InvalidStateForPaymentLinkError,
  InvoiceNotFoundError,
} from "../domain/invoice.errors";

export interface CreatePaymentLinkResult {
  paymentLinkUrl: string;
}

@Injectable()
export class CreatePaymentLinkUseCase {
  private readonly logger = new Logger(CreatePaymentLinkUseCase.name);

  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoices: InvoiceRepository,
    @Inject(STRIPE_PAYMENT_LINK_SERVICE)
    private readonly stripe: StripePaymentLinkService,
  ) {}

  async execute(
    id: string,
    businessId: string,
  ): Promise<CreatePaymentLinkResult> {
    const invoice = await this.invoices.findForPaymentLink(id, businessId);
    if (!invoice) throw new InvoiceNotFoundError(id);

    if (invoice.status === "paid" || invoice.status === "voided") {
      throw new InvalidStateForPaymentLinkError(id, invoice.status);
    }

    // Idempotent: if the invoice already has a payment link (e.g. native
    // QuickBooks/Xero link populated during sync), return it as-is. We do not
    // re-create or overwrite.
    if (invoice.paymentLinkUrl) {
      return { paymentLinkUrl: invoice.paymentLinkUrl };
    }

    // Spec hard-codes USD for Stripe Payment Links in MVP; the adapter
    // ignores the currency arg and always uses "usd". See plan section
    // "Open questions" for the multi-currency follow-up.
    const result = await this.stripe.createPaymentLink({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.companyName,
      balanceDueCents: invoice.balanceDueCents,
      currency: "USD",
    });

    await this.invoices.updatePaymentLinkUrl(
      id,
      businessId,
      result.paymentLinkUrl,
    );

    this.logger.log({
      msg: `payment link created for invoice ${invoice.invoiceNumber ?? id}`,
      event: "payment_link_created",
      invoiceId: id,
      businessId,
    });

    return { paymentLinkUrl: result.paymentLinkUrl };
  }
}
