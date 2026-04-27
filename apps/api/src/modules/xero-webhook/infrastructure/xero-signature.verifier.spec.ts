import { createHmac } from "crypto";
import { HmacXeroSignatureVerifier } from "./xero-signature.verifier";

const TOKEN = "test-xero-webhook-key-abcdef";
const BODY = Buffer.from(
  JSON.stringify({
    events: [
      {
        resourceUrl: "https://api.xero.com/api.xro/2.0/Invoices/abc",
        resourceId: "abc",
        tenantId: "tenant-1",
        eventCategory: "INVOICE",
        eventType: "UPDATE",
        eventDateUtc: "2026-04-26T12:00:00.0000000",
      },
    ],
    firstEventSequence: 1,
    lastEventSequence: 1,
  }),
);

const validSig = createHmac("sha256", TOKEN).update(BODY).digest("base64");

describe("HmacXeroSignatureVerifier", () => {
  let verifier: HmacXeroSignatureVerifier;

  beforeEach(() => {
    verifier = new HmacXeroSignatureVerifier(TOKEN);
  });

  it("returns true for a correctly-signed body", () => {
    expect(verifier.verify(BODY, validSig)).toBe(true);
  });

  it("returns false when signature is missing", () => {
    expect(verifier.verify(BODY, "")).toBe(false);
  });

  it("returns false when body is empty", () => {
    expect(verifier.verify(Buffer.alloc(0), validSig)).toBe(false);
  });

  it("returns false when signature is wrong", () => {
    expect(
      verifier.verify(BODY, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
    ).toBe(false);
  });

  it("returns false when signature is a different length (avoids timingSafeEqual throw)", () => {
    expect(verifier.verify(BODY, "short")).toBe(false);
  });

  it("returns false when token is empty", () => {
    const empty = new HmacXeroSignatureVerifier("");
    expect(empty.verify(BODY, validSig)).toBe(false);
  });

  it("returns false when body is mutated by even one byte", () => {
    const mutated = Buffer.concat([BODY, Buffer.from(" ")]);
    expect(verifier.verify(mutated, validSig)).toBe(false);
  });
});
