import { createHmac, timingSafeEqual } from "crypto";

export interface XeroSignatureVerifier {
  verify(rawBody: Buffer, signature: string): boolean;
}

export const XERO_SIGNATURE_VERIFIER = Symbol("XERO_SIGNATURE_VERIFIER");

export class HmacXeroSignatureVerifier implements XeroSignatureVerifier {
  constructor(private readonly webhookKey: string) {}

  verify(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookKey) return false;
    if (!signature) return false;
    if (!rawBody || rawBody.length === 0) return false;

    const expected = createHmac("sha256", this.webhookKey)
      .update(rawBody)
      .digest("base64");

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
