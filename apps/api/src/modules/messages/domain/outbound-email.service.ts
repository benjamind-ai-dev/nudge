export interface SendEmailParams {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  externalMessageId: string;
}

export interface OutboundEmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

export const OUTBOUND_EMAIL_SERVICE = Symbol("OutboundEmailService");
