export const SINGLE_CHANNELS = ["email", "sms"] as const;
export type SingleChannel = (typeof SINGLE_CHANNELS)[number];

export const MESSAGE_CHANNELS = [...SINGLE_CHANNELS, "email_and_sms"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export function isValidChannel(channel: string): channel is MessageChannel {
  return MESSAGE_CHANNELS.includes(channel as MessageChannel);
}

export const RUN_STATUSES = ["active", "completed", "paused", "stopped"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const MESSAGE_STATUSES = ["sent", "failed", "queued"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface RunReadyToSend {
  runId: string;
  runStatus: RunStatus;
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
  channel: SingleChannel;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  body: string;
  status: MessageStatus;
  externalMessageId: string | null;
  sentAt: Date | null;
}

export interface UpdateMessageStatusData {
  id: string;
  businessId: string;
  status: MessageStatus;
  externalMessageId: string | null;
  sentAt: Date | null;
}

export interface MessageSendRepository {
  findRunsReadyToSend(limit?: number): Promise<RunReadyToSend[]>;
  findRunById(id: string, businessId: string): Promise<RunReadyToSend | null>;
  findNextStep(sequenceId: string, businessId: string, currentStepOrder: number): Promise<NextStep | null>;
  messageExistsForRunStep(runId: string, stepId: string, channel: string, businessId: string): Promise<boolean>;
  createMessage(data: CreateMessageData): Promise<{ created: boolean }>;
  updateMessageStatus(data: UpdateMessageStatusData): Promise<void>;
  advanceRunToNextStep(runId: string, businessId: string, nextStepId: string, nextSendAt: Date): Promise<void>;
  completeRun(runId: string, businessId: string): Promise<void>;
}

export const MESSAGE_SEND_REPOSITORY = Symbol("MessageSendRepository");
