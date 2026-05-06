export type Channel = "email" | "sms" | "email_and_sms";

export interface SequenceStep {
  id: string;
  stepOrder: number;
  delayDays: number;
  channel: Channel;
  subjectTemplate: string | null;
  bodyTemplate: string;
  smsBodyTemplate: string | null;
  isOwnerAlert: boolean;
  includePaymentLink: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceSummary {
  id: string;
  businessId: string;
  name: string;
  stepCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceWithSteps extends SequenceSummary {
  steps: SequenceStep[];
}
