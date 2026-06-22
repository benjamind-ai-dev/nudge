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

export class InvoiceNotChaseableError extends DomainError {
  readonly httpStatus = 409;

  constructor(
    public readonly invoiceId: string,
    public readonly status: string,
  ) {
    super(
      `Cannot start follow-up for invoice ${invoiceId} (status=${status}); only open, overdue, or partial invoices can be chased`,
    );
    this.name = "InvoiceNotChaseableError";
  }
}

export class NoActiveSequenceError extends DomainError {
  readonly httpStatus = 422;

  constructor(public readonly invoiceId: string) {
    super(`No active follow-up sequence is configured for invoice ${invoiceId}`);
    this.name = "NoActiveSequenceError";
  }
}

export class NoStepsError extends DomainError {
  readonly httpStatus = 422;

  constructor(public readonly sequenceId: string) {
    super(`Sequence ${sequenceId} has no steps`);
    this.name = "NoStepsError";
  }
}
