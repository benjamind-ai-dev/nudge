export class MessageNotFoundError extends Error {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} not found`);
    this.name = "MessageNotFoundError";
  }
}

export class NoReplyToRespondToError extends Error {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} has no reply to respond to`);
    this.name = "NoReplyToRespondToError";
  }
}

export class CustomerHasNoEmailError extends Error {
  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} has no contact email`);
    this.name = "CustomerHasNoEmailError";
  }
}

export class OutboundEmailSendError extends Error {
  constructor(public readonly messageId: string, cause: unknown) {
    super(`Failed to send reply for message ${messageId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "OutboundEmailSendError";
  }
}
