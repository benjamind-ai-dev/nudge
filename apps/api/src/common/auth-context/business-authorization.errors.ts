import { DomainError } from "../errors/domain.error";

export class CallerNotProvisionedError extends DomainError {
  readonly httpStatus = 401;

  constructor(clerkUserId: string) {
    super(`No provisioned user row for clerk session ${clerkUserId}`);
    this.name = "CallerNotProvisionedError";
  }
}
