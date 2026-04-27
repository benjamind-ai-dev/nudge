import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { XeroSignatureGuard } from "./xero-signature.guard";
import type { XeroSignatureVerifier } from "./xero-signature.verifier";

const ctxFor = (
  req: Partial<RawBodyRequest<Request>>,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  }) as unknown as ExecutionContext;

const reqWith = (
  rawBody: Buffer | undefined,
  signature: string | undefined,
): Partial<RawBodyRequest<Request>> => ({
  rawBody,
  headers: signature ? { "x-xero-signature": signature } : {},
} as Partial<RawBodyRequest<Request>>);

describe("XeroSignatureGuard", () => {
  let verifier: jest.Mocked<XeroSignatureVerifier>;
  let guard: XeroSignatureGuard;

  beforeEach(() => {
    verifier = { verify: jest.fn() };
    guard = new XeroSignatureGuard(verifier);
  });

  it("returns true when verifier accepts the signature", () => {
    verifier.verify.mockReturnValue(true);
    const ctx = ctxFor(reqWith(Buffer.from("payload"), "sig"));
    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(Buffer.from("payload"), "sig");
  });

  it("throws UnauthorizedException when x-xero-signature header is missing", () => {
    const ctx = ctxFor(reqWith(Buffer.from("payload"), undefined));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when raw body is missing or empty", () => {
    expect(() =>
      guard.canActivate(ctxFor(reqWith(undefined, "sig"))),
    ).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(ctxFor(reqWith(Buffer.alloc(0), "sig"))),
    ).toThrow(UnauthorizedException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when verifier rejects", () => {
    verifier.verify.mockReturnValue(false);
    const ctx = ctxFor(reqWith(Buffer.from("payload"), "wrong"));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("uses the lowercase 'x-xero-signature' header (Express normalizes)", () => {
    verifier.verify.mockReturnValue(true);
    const ctx = ctxFor({
      rawBody: Buffer.from("p"),
      headers: { "x-xero-signature": "good" },
    } as Partial<RawBodyRequest<Request>>);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(Buffer.from("p"), "good");
  });
});
