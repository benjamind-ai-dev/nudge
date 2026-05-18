export class MessageNotFoundError extends Error {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} not found`);
    this.name = "MessageNotFoundError";
  }
}
