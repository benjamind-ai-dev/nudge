export class EncryptionError extends Error {
  constructor(public readonly cause: unknown) {
    super("Failed to encrypt/decrypt connection tokens");
    this.name = "EncryptionError";
  }
}
