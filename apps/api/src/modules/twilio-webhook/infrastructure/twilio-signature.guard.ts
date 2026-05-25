import { createHmac } from "crypto";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../../common/config/env.schema";

const SIGNATURE_HEADER = "x-twilio-signature";

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);
  private readonly authToken: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.authToken = config.get("TWILIO_AUTH_TOKEN", { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers[SIGNATURE_HEADER] as string | undefined;

    if (!signature) {
      this.logger.warn({ msg: "Twilio webhook rejected: missing signature header" });
      throw new ForbiddenException("Missing Twilio signature");
    }

    const url = this.buildUrl(req);
    const params = (req.body as Record<string, unknown> | undefined) ?? {};
    const expected = this.sign(url, params);

    if (!safeEqual(expected, signature)) {
      this.logger.warn({
        msg: "Twilio webhook signature mismatch",
        event: "twilio_webhook_invalid_signature",
        url,
      });
      throw new ForbiddenException("Invalid Twilio webhook signature");
    }

    return true;
  }

  private buildUrl(req: Request): string {
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ??
      req.protocol;
    const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.get("host");
    return `${proto}://${host}${req.originalUrl}`;
  }

  private sign(url: string, params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort();
    const data = sortedKeys.reduce(
      (acc, key) => acc + key + String(params[key] ?? ""),
      url,
    );
    return createHmac("sha1", this.authToken).update(data, "utf-8").digest("base64");
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
