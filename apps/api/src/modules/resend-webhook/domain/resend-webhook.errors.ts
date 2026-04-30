export class DuplicateResendBatchError extends Error {
  constructor(key: string) {
    super(`Resend batch already processed: ${key}`);
    this.name = "DuplicateResendBatchError";
  }
}
