export const MESSAGE_CHANNELS = ["email", "sms", "email_and_sms"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export function isValidChannel(channel: string): channel is MessageChannel {
  return MESSAGE_CHANNELS.includes(channel as MessageChannel);
}

export interface RunReadyToSend {
  runId: string;
  runStatus: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amountCents: number;
  balanceDueCents: number;
  dueDate: Date;
  paymentLinkUrl: string | null;
  customerId: string;
  customerCompanyName: string;
  customerContactName: string | null;
  customerContactEmail: string | null;
  customerContactPhone: string | null;
  businessId: string;
  businessName: string;
  businessSenderName: string;
  businessSenderEmail: string;
  businessEmailSignature: string | null;
  businessTimezone: string;
  sequenceId: string;
  stepId: string;
  stepOrder: number;
  stepChannel: MessageChannel;
  stepSubjectTemplate: string | null;
  stepBodyTemplate: string;
  stepSmsBodyTemplate: string | null;
  stepIsOwnerAlert: boolean;
  stepDelayDays: number;
}

export interface NextStep {
  id: string;
  stepOrder: number;
  delayDays: number;
}

export interface CreateMessageData {
  id: string;
  sequenceRunId: string;
  sequenceStepId: string;
  invoiceId: string;
  customerId: string;
  businessId: string;
  channel: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  body: string;
  status: string;
  externalMessageId: string | null;
  sentAt: Date;
}

export interface MessageSendRepository {
  findRunsReadyToSend(limit?: number): Promise<RunReadyToSend[]>;
  findRunById(id: string, businessId: string): Promise<RunReadyToSend | null>;
  findNextStep(sequenceId: string, currentStepOrder: number): Promise<NextStep | null>;
  messageExistsForRunStep(runId: string, stepId: string, channel: string): Promise<boolean>;
  createMessage(data: CreateMessageData): Promise<{ created: boolean }>;
  advanceRunToNextStep(runId: string, businessId: string, nextStepId: string, nextSendAt: Date): Promise<void>;
  completeRun(runId: string, businessId: string): Promise<void>;
}

export const MESSAGE_SEND_REPOSITORY = Symbol("MessageSendRepository");
