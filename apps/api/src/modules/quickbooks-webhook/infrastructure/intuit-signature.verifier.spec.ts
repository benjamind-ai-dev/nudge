import { createHmac } from "crypto";
import { HmacIntuitSignatureVerifier } from "./intuit-signature.verifier";

const TOKEN = "test-verifier-token-abcdef";
const BODY = Buffer.from(
  JSON.stringify([
    {
      specversion: "1.0",
      id: "evt-1",
      source: "intuit",
      type: "qbo.invoice.updated.v1",
      time: "2026-04-26T12:00:00Z",
      intuitentityid: "1234",
      intuitaccountid: "310687",
    },
  ]),
);

const validSig = createHmac("sha256", TOKEN).update(BODY).digest("base64");

describe("HmacIntuitSignatureVerifier", () => {
  let verifier: HmacIntuitSignatureVerifier;

  beforeEach(() => {
    verifier = new HmacIntuitSignatureVerifier(TOKEN);
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
    const empty = new HmacIntuitSignatureVerifier("");
    expect(empty.verify(BODY, validSig)).toBe(false);
  });

  it("returns false when body is mutated by even one byte", () => {
    const mutated = Buffer.concat([BODY, Buffer.from(" ")]);
    expect(verifier.verify(mutated, validSig)).toBe(false);
  });
});
