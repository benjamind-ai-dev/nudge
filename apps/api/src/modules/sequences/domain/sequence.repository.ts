import type { SequenceSummary, SequenceStep, SequenceWithSteps, Channel } from "./sequence.entity";

export const SEQUENCE_REPOSITORY = Symbol("SequenceRepository");

export interface CreateSequenceData {
  businessId: string;
  name: string;
  relationshipTierId?: string | null;
}

export interface UpdateSequenceData {
  name?: string;
  isActive?: boolean;
  relationshipTierId?: string | null;
}

export interface CreateStepData {
  stepOrder: number;
  delayDays: number;
  channel: Channel;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  smsBodyTemplate?: string | null;
  isOwnerAlert?: boolean;
  includePaymentLink?: boolean;
}

export interface UpdateStepData {
  stepOrder?: number;
  delayDays?: number;
  channel?: Channel;
  subjectTemplate?: string | null;
  bodyTemplate?: string;
  smsBodyTemplate?: string | null;
  isOwnerAlert?: boolean;
  includePaymentLink?: boolean;
}

export interface ReplaceSequenceData {
  name: string;
  relationshipTierId?: string | null;
  steps: CreateStepData[];
}

export interface SequenceRepository {
  findAllByBusiness(businessId: string): Promise<SequenceSummary[]>;
  findById(id: string, businessId: string): Promise<SequenceWithSteps | null>;
  create(data: CreateSequenceData): Promise<SequenceSummary>;
  createWithSteps(data: CreateSequenceData & { steps: CreateStepData[] }): Promise<SequenceWithSteps>;
  update(id: string, businessId: string, data: UpdateSequenceData): Promise<SequenceSummary>;
  delete(id: string, businessId: string): Promise<void>;
  isReferencedByTierOrCustomer(id: string, businessId: string): Promise<boolean>;
  countByBusiness(businessId: string): Promise<number>;
  countActiveRuns(sequenceId: string, businessId: string): Promise<number>;
  replaceSteps(id: string, businessId: string, data: ReplaceSequenceData): Promise<SequenceWithSteps>;
  addStep(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep>;
  updateStep(stepId: string, sequenceId: string, businessId: string, data: UpdateStepData): Promise<SequenceStep>;
  deleteStep(stepId: string, sequenceId: string, businessId: string): Promise<void>;
  reorderSteps(sequenceId: string, businessId: string, stepOrders: Array<{ stepId: string; stepOrder: number }>): Promise<void>;
  findSenderName(businessId: string): Promise<string | null>;
}
