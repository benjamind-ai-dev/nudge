export class BusinessNotFoundError extends Error {
  constructor(id: string) {
    super(`Business ${id} not found`);
  }
}

export class NoActiveConnectionError extends Error {
  constructor(businessId: string) {
    super(`Business ${businessId} has no active accounting connection`);
  }
}

export class SyncRateLimitedError extends Error {
  constructor(
    businessId: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      `Sync for business ${businessId} rate-limited; retry in ${retryAfterSeconds}s`,
    );
  }
}
