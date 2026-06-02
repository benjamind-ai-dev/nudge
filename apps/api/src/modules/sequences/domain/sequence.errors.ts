import { MAX_SEQUENCES_PER_BUSINESS, MAX_STEPS_PER_SEQUENCE } from "./sequence.entity";

export class SequenceNotFoundError extends Error {
  constructor(public readonly sequenceId: string) {
    super(`Sequence ${sequenceId} not found`);
    this.name = "SequenceNotFoundError";
  }
}

export class SequenceStepNotFoundError extends Error {
  constructor(public readonly stepId: string) {
    super(`Sequence step ${stepId} not found`);
    this.name = "SequenceStepNotFoundError";
  }
}

export class SequenceInUseError extends Error {
  constructor(public readonly sequenceId: string) {
    super(`Sequence ${sequenceId} is assigned to a tier or customer and cannot be deleted`);
    this.name = "SequenceInUseError";
  }
}

export class SequenceHasActiveRunsError extends Error {
  constructor(public readonly sequenceId: string) {
    super("Cannot replace a sequence with active runs. Stop all runs first or create a new sequence.");
    this.name = "SequenceHasActiveRunsError";
  }
}

export class SequenceLimitReachedError extends Error {
  constructor(max: number = MAX_SEQUENCES_PER_BUSINESS) {
    super(
      Number.isFinite(max)
        ? `Your plan includes ${max} sequence${max === 1 ? "" : "s"} per business. Upgrade for more.`
        : `Maximum sequences per business reached`,
    );
    this.name = "SequenceLimitReachedError";
  }
}

export class StepLimitReachedError extends Error {
  constructor() {
    super(`Maximum ${MAX_STEPS_PER_SEQUENCE} steps per sequence`);
    this.name = "StepLimitReachedError";
  }
}

export class InvalidStepOrderError extends Error {
  constructor() {
    super("Step order must be sequential starting at 1 with no gaps");
    this.name = "InvalidStepOrderError";
  }
}
