export interface CreatePaymentLinkParams {
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string;
  balanceDueCents: number;
  currency: string;
}

export interface PaymentLinkResult {
  paymentLinkUrl: string;
}

export interface StripePaymentLinkService {
  createPaymentLink(
    params: CreatePaymentLinkParams,
  ): Promise<PaymentLinkResult>;
}

export const STRIPE_PAYMENT_LINK_SERVICE = Symbol("StripePaymentLinkService");
