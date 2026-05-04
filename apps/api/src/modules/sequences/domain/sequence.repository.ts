import type { SequenceSummary, SequenceStep, SequenceWithSteps, Channel } from "./sequence.entity";

export const SEQUENCE_REPOSITORY = Symbol("SequenceRepository");

export interface CreateSequenceData {
  businessId: string;
  name: string;
}

export interface UpdateSequenceData {
  name?: string;
}

export interface CreateStepData {
  stepOrder: number;
  delayDays: number;
  channel: Channel;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  smsBodyTemplate?: string | null;
  isOwnerAlert?: boolean;
}

export interface UpdateStepData {
  stepOrder?: number;
  delayDays?: number;
  channel?: Channel;
  subjectTemplate?: string | null;
  bodyTemplate?: string;
  smsBodyTemplate?: string | null;
  isOwnerAlert?: boolean;
}

export interface SequenceRepository {
  findAllByBusiness(businessId: string): Promise<SequenceSummary[]>;
  findById(id: string, businessId: string): Promise<SequenceWithSteps | null>;
  create(data: CreateSequenceData): Promise<SequenceSummary>;
  update(id: string, businessId: string, data: UpdateSequenceData): Promise<SequenceSummary>;
  delete(id: string, businessId: string): Promise<void>;
  isReferencedByTierOrCustomer(id: string, businessId: string): Promise<boolean>;
  addStep(sequenceId: string, businessId: string, data: CreateStepData): Promise<SequenceStep>;
  updateStep(stepId: string, sequenceId: string, businessId: string, data: UpdateStepData): Promise<SequenceStep>;
  deleteStep(stepId: string, sequenceId: string, businessId: string): Promise<void>;
  reorderSteps(sequenceId: string, businessId: string, stepOrders: Array<{ stepId: string; stepOrder: number }>): Promise<void>;
}
