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

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

export const EMAIL_SERVICE = Symbol("EmailService");
