import { DomainError } from "../../../common/errors/domain.error";

export class UserNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly userId: string) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

export class CannotChangeOwnRoleError extends DomainError {
  readonly httpStatus = 400;

  constructor() {
    super("You cannot change your own role");
    this.name = "CannotChangeOwnRoleError";
  }
}

export class CannotChangeOwnerRoleError extends DomainError {
  readonly httpStatus = 400;

  constructor() {
    super("The account owner's role cannot be changed");
    this.name = "CannotChangeOwnerRoleError";
  }
}

export class CannotRemoveSelfError extends DomainError {
  readonly httpStatus = 400;

  constructor() {
    super("You cannot remove yourself");
    this.name = "CannotRemoveSelfError";
  }
}

export class CannotRemoveOwnerError extends DomainError {
  readonly httpStatus = 400;

  constructor() {
    super("The account owner cannot be removed");
    this.name = "CannotRemoveOwnerError";
  }
}

export class EmailAlreadyInUseError extends DomainError {
  readonly httpStatus = 409;

  constructor(public readonly email: string) {
    super(`This email is already in use`);
    this.name = "EmailAlreadyInUseError";
  }
}

export class InviteSendFailedError extends DomainError {
  readonly httpStatus = 502;

  constructor(
    public readonly email: string,
    public readonly cause?: unknown,
  ) {
    super(`Failed to send invitation to ${email}`);
    this.name = "InviteSendFailedError";
  }
}

export class SeatLimitReachedError extends DomainError {
  readonly httpStatus = 409;

  constructor(public readonly maxSeats: number) {
    super(
      `Your plan includes ${maxSeats} team member${maxSeats === 1 ? "" : "s"}. Upgrade to invite more.`,
    );
    this.name = "SeatLimitReachedError";
  }
}

export class PendingUserNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(public readonly userId: string) {
    super(`Pending user ${userId} not found`);
    this.name = "PendingUserNotFoundError";
  }
}

export class CannotCancelAcceptedInviteError extends DomainError {
  readonly httpStatus = 409;

  constructor(public readonly userId: string) {
    super(`User ${userId} has already accepted their invitation`);
    this.name = "CannotCancelAcceptedInviteError";
  }
}
