import { ExecutionContext, ForbiddenException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Webhook } from "svix";
import { ResendWebhookGuard, RESEND_EVENTS_KEY } from "./resend-webhook.guard";

const TEST_SECRET = "whsec_MfKQ9r8GKYqrTwjUPZB8TDgpZv+7t4gQdMqNBfWGGlc=";

function makeSignedHeaders(body: string): Record<string, string> {
  const wh = new Webhook(TEST_SECRET);
  const msgId = "msg_test_" + Date.now();
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signature = wh.sign(msgId, now, body);
  return {
    "svix-id": msgId,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  };
}

function makeContext(
  body: string,
  headers: Record<string, string | undefined>,
): ExecutionContext {
  const req = {
    rawBody: Buffer.from(body),
    headers,
  } as unknown;

  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as ExecutionContext;
}

describe("ResendWebhookGuard", () => {
  let guard: ResendWebhookGuard;

  beforeEach(() => {
    const config = {
      get: () => TEST_SECRET,
    } as unknown as ConfigService;
    guard = new ResendWebhookGuard(config);
  });

  it("passes and attaches events when signature is valid", () => {
    const events = [{ type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }];
    const body = JSON.stringify(events);
    const signedHeaders = makeSignedHeaders(body);

    const ctx = makeContext(body, signedHeaders);
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    expect(req[RESEND_EVENTS_KEY]).toEqual(events);
  });

  it("throws ForbiddenException when signature is invalid", () => {
    const body = JSON.stringify([{ type: "email.delivered" }]);
    const ctx = makeContext(body, {
      "svix-id": "msg_fake",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,invalidsignature",
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("throws BadRequestException when svix headers are missing", () => {
    const body = JSON.stringify([{ type: "email.delivered" }]);
    const ctx = makeContext(body, {});

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it("throws BadRequestException when rawBody is empty", () => {
    const ctx = makeContext("", {
      "svix-id": "msg_test",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,sig",
    });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it("normalises a single event object (not array) into an array", () => {
    const event = { type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } };
    const body = JSON.stringify(event);
    const signedHeaders = makeSignedHeaders(body);

    const ctx = makeContext(body, signedHeaders);
    guard.canActivate(ctx);

    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    expect(Array.isArray(req[RESEND_EVENTS_KEY])).toBe(true);
    expect((req[RESEND_EVENTS_KEY] as unknown[])[0]).toEqual(event);
  });
});
