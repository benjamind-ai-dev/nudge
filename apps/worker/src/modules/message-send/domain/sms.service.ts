export interface SendSmsParams {
  to: string;
  body: string;
  businessId: string;
  invoiceId: string;
  sequenceStepId: string;
}

export interface SendSmsResult {
  externalMessageId: string;
}

export interface SmsService {
  send(params: SendSmsParams): Promise<SendSmsResult>;
}

export const SMS_SERVICE = Symbol("SmsService");
