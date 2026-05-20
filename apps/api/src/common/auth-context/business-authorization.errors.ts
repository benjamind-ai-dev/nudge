export class CallerNotProvisionedError extends Error {
  constructor(clerkUserId: string) {
    super(`No provisioned user row for clerk session ${clerkUserId}`);
    this.name = "CallerNotProvisionedError";
  }
}
