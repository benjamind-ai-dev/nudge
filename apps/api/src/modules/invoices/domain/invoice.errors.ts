import { DomainError } from "../../../common/errors/domain.error";

export class InvoiceNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly invoiceId: string) {
    super(`Invoice ${invoiceId} not found`);
    this.name = "InvoiceNotFoundError";
  }
}

export class InvalidStateForPaymentLinkError extends DomainError {
  readonly httpStatus = 400;

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
