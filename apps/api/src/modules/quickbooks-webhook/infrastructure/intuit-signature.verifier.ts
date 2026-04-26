import { createHmac, timingSafeEqual } from "crypto";

export interface IntuitSignatureVerifier {
  verify(rawBody: Buffer, signature: string): boolean;
}

export const INTUIT_SIGNATURE_VERIFIER = Symbol("INTUIT_SIGNATURE_VERIFIER");

export class HmacIntuitSignatureVerifier implements IntuitSignatureVerifier {
  constructor(private readonly token: string) {}

  verify(rawBody: Buffer, signature: string): boolean {
    if (!this.token) return false;
    if (!signature) return false;
    if (!rawBody || rawBody.length === 0) return false;

    const expected = createHmac("sha256", this.token)
      .update(rawBody)
      .digest("base64");

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
