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
  stepChannel: string;
  stepSubjectTemplate: string | null;
  stepBodyTemplate: string;
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
  findRunsReadyToSend(): Promise<RunReadyToSend[]>;
  findRunById(id: string): Promise<RunReadyToSend | null>;
  findNextStep(sequenceId: string, currentStepOrder: number): Promise<NextStep | null>;
  messageExistsForRunStep(runId: string, stepId: string, channel: string): Promise<boolean>;
  createMessage(data: CreateMessageData): Promise<void>;
  advanceRunToNextStep(runId: string, nextStepId: string, nextSendAt: Date): Promise<void>;
  completeRun(runId: string): Promise<void>;
}

export const MESSAGE_SEND_REPOSITORY = Symbol("MessageSendRepository");
