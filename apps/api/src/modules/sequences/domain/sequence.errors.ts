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
