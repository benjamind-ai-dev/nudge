import { DomainError } from "../../../common/errors/domain.error";

export class MessageNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly messageId: string) {
    super(`Message ${messageId} not found`);
    this.name = "MessageNotFoundError";
  }
}

export class NoReplyToRespondToError extends DomainError {
  readonly httpStatus = 409;

  constructor(public readonly messageId: string) {
    super(`Message ${messageId} has no reply to respond to`);
    this.name = "NoReplyToRespondToError";
  }
}

export class CustomerHasNoEmailError extends DomainError {
  readonly httpStatus = 422;

  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} has no contact email`);
    this.name = "CustomerHasNoEmailError";
  }
}

export class OutboundEmailSendError extends DomainError {
  readonly httpStatus = 502;

  constructor(public readonly messageId: string, cause: unknown) {
    super(`Failed to send reply for message ${messageId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "OutboundEmailSendError";
  }
}
