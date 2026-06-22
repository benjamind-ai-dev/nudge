import { DomainError } from "../../../common/errors/domain.error";

export class SequenceRunNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly sequenceRunId: string) {
    super(`Sequence run ${sequenceRunId} not found`);
    this.name = "SequenceRunNotFoundError";
  }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly httpStatus = 400;

  constructor(
    public readonly sequenceRunId: string,
    public readonly fromStatus: string,
    public readonly action: "pause" | "resume" | "stop",
  ) {
    super(
      `Cannot ${action} sequence run ${sequenceRunId} from status ${fromStatus}`,
    );
    this.name = "InvalidStatusTransitionError";
  }
}
