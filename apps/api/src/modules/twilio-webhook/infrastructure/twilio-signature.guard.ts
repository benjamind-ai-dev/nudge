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
    const rawHeader = req.headers[SIGNATURE_HEADER];
    // Express headers can be string[] for repeated headers; take the first value.
    const signature = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

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
      pickFirst(req.headers["x-forwarded-proto"])?.split(",")[0]?.trim() ??
      req.protocol;
    let host = pickFirst(req.headers["x-forwarded-host"]) ?? req.get("host") ?? "";
    host = host.split(",")[0].trim();
    // Twilio signs without the default port; strip :443 / :80 to keep parity.
    if (proto === "https" && host.endsWith(":443")) host = host.slice(0, -4);
    if (proto === "http" && host.endsWith(":80")) host = host.slice(0, -3);
    return `${proto}://${host}${req.originalUrl}`;
  }

  private sign(url: string, params: Record<string, unknown>): string {
    // Twilio's reference algorithm: for each key in lexicographic order, append
    // the key followed by each value as a separate string. Repeated-key /
    // array-valued params (e.g., MMS MediaUrlN if Express coerces) must be
    // emitted per-value, not joined with commas (which is what String(arr) does).
    const sortedKeys = Object.keys(params).sort();
    const data = sortedKeys.reduce((acc, key) => {
      const value = params[key];
      if (Array.isArray(value)) {
        return value.reduce<string>((inner, v) => inner + key + String(v ?? ""), acc);
      }
      return acc + key + String(value ?? "");
    }, url);
    return createHmac("sha1", this.authToken).update(data, "utf-8").digest("base64");
  }
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
