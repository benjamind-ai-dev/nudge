export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

export class CannotChangeOwnRoleError extends Error {
  constructor() {
    super("You cannot change your own role");
    this.name = "CannotChangeOwnRoleError";
  }
}

export class CannotChangeOwnerRoleError extends Error {
  constructor() {
    super("The account owner's role cannot be changed");
    this.name = "CannotChangeOwnerRoleError";
  }
}

export class CannotRemoveSelfError extends Error {
  constructor() {
    super("You cannot remove yourself");
    this.name = "CannotRemoveSelfError";
  }
}

export class CannotRemoveOwnerError extends Error {
  constructor() {
    super("The account owner cannot be removed");
    this.name = "CannotRemoveOwnerError";
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(public readonly email: string) {
    super(`This email is already in use`);
    this.name = "EmailAlreadyInUseError";
  }
}

export class InviteSendFailedError extends Error {
  constructor(
    public readonly email: string,
    public readonly cause?: unknown,
  ) {
    super(`Failed to send invitation to ${email}`);
    this.name = "InviteSendFailedError";
  }
}

export class PendingUserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`Pending user ${userId} not found`);
    this.name = "PendingUserNotFoundError";
  }
}

export class CannotCancelAcceptedInviteError extends Error {
  constructor(public readonly userId: string) {
    super(`User ${userId} has already accepted their invitation`);
    this.name = "CannotCancelAcceptedInviteError";
  }
}
