export class InvoiceNotFoundError extends Error {
  constructor(public readonly invoiceId: string) {
    super(`Invoice ${invoiceId} not found`);
    this.name = "InvoiceNotFoundError";
  }
}

export class InvalidStateForPaymentLinkError extends Error {
  constructor(
    public readonly invoiceId: string,
    public readonly status: string,
  ) {
    super(
      `Cannot generate payment link for a paid or voided invoice (invoice ${invoiceId} status=${status})`,
    );
    this.name = "InvalidStateForPaymentLinkError";
  }
}
