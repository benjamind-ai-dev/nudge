export class SequenceRunNotFoundError extends Error {
  constructor(public readonly sequenceRunId: string) {
    super(`Sequence run ${sequenceRunId} not found`);
    this.name = "SequenceRunNotFoundError";
  }
}
