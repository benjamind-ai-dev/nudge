export const MAX_SEQUENCES_PER_BUSINESS = 5;
export const MAX_STEPS_PER_SEQUENCE = 10;

export type Channel = "email" | "sms" | "email_and_sms";

/** Whether a channel sends SMS (gated by the plan's `sms` entitlement). */
export function channelUsesSms(channel: Channel): boolean {
  return channel === "sms" || channel === "email_and_sms";
}

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
  isActive: boolean;
  stepCount: number;
  activeRuns: number;
  relationshipTier: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceWithSteps extends SequenceSummary {
  steps: SequenceStep[];
}
