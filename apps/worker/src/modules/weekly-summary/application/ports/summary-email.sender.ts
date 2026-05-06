export const SUMMARY_EMAIL_SENDER = Symbol("SUMMARY_EMAIL_SENDER");

export interface SummaryEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendSummaryResult {
  externalMessageId: string;
}

export interface SummaryEmailSender {
  send(email: SummaryEmail): Promise<SendSummaryResult>;
}
