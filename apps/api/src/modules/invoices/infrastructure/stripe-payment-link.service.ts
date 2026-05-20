import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { Env } from "../../../common/config/env.schema";
import type {
  CreatePaymentLinkParams,
  PaymentLinkResult,
  StripePaymentLinkService,
} from "../domain/stripe-payment-link.service";

@Injectable()
export class StripePaymentLinkAdapter implements StripePaymentLinkService {
  private readonly logger = new Logger(StripePaymentLinkAdapter.name);
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(config: ConfigService<Env, true>) {
    this.stripe = new Stripe(
      config.get("STRIPE_SECRET_KEY", { infer: true }),
      { apiVersion: "2026-03-25.dahlia" },
    );
  }

  async createPaymentLink(
    params: CreatePaymentLinkParams,
  ): Promise<PaymentLinkResult> {
    const description = params.invoiceNumber
      ? `Invoice ${params.invoiceNumber} — ${params.customerName}`
      : `Invoice ${params.invoiceId} — ${params.customerName}`;

    const link = await this.stripe.paymentLinks.create({
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: params.balanceDueCents,
            product_data: {
              name: params.invoiceNumber
                ? `Invoice ${params.invoiceNumber}`
                : `Invoice ${params.invoiceId}`,
              description,
            },
          },
        },
      ],
      metadata: { invoice_id: params.invoiceId },
    });

    if (!link.url) {
      this.logger.error({
        msg: "stripe_payment_link_no_url",
        invoiceId: params.invoiceId,
      });
      throw new Error("Stripe did not return a payment link URL");
    }

    return { paymentLinkUrl: link.url };
  }
}
