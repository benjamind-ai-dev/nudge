import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { IntuitSignatureGuard } from "./intuit-signature.guard";
import type { IntuitSignatureVerifier } from "./intuit-signature.verifier";

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
  headers: signature ? { "intuit-signature": signature } : {},
} as Partial<RawBodyRequest<Request>>);

describe("IntuitSignatureGuard", () => {
  let verifier: jest.Mocked<IntuitSignatureVerifier>;
  let guard: IntuitSignatureGuard;

  beforeEach(() => {
    verifier = { verify: jest.fn() };
    guard = new IntuitSignatureGuard(verifier);
  });

  it("returns true when verifier accepts the signature", () => {
    verifier.verify.mockReturnValue(true);
    const ctx = ctxFor(reqWith(Buffer.from("payload"), "sig"));
    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(Buffer.from("payload"), "sig");
  });

  it("throws ForbiddenException when intuit-signature header is missing", () => {
    const ctx = ctxFor(reqWith(Buffer.from("payload"), undefined));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when raw body is missing or empty", () => {
    expect(() =>
      guard.canActivate(ctxFor(reqWith(undefined, "sig"))),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(ctxFor(reqWith(Buffer.alloc(0), "sig"))),
    ).toThrow(ForbiddenException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when verifier rejects", () => {
    verifier.verify.mockReturnValue(false);
    const ctx = ctxFor(reqWith(Buffer.from("payload"), "wrong"));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("uses the lowercase 'intuit-signature' header (Express normalizes)", () => {
    verifier.verify.mockReturnValue(true);
    const ctx = ctxFor({
      rawBody: Buffer.from("p"),
      headers: { "intuit-signature": "good" },
    } as Partial<RawBodyRequest<Request>>);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(Buffer.from("p"), "good");
  });
});
