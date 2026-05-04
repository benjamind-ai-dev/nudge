export class WeeklySummaryAlreadyExistsError extends Error {
  constructor(
    public readonly businessId: string,
    public readonly weekStartsAt: string,
  ) {
    super(`Weekly summary already exists for business ${businessId} week ${weekStartsAt}`);
    this.name = "WeeklySummaryAlreadyExistsError";
  }
}

export class NoOwnerRecipientsError extends Error {
  constructor(public readonly businessId: string) {
    super(`No owner users found for business ${businessId}`);
    this.name = "NoOwnerRecipientsError";
  }
}
