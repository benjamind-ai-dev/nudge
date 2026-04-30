import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Webhook } from "svix";
import type { Env } from "../../../common/config/env.schema";

export const RESEND_EVENTS_KEY = "resendEvents";

@Injectable()
export class ResendWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ResendWebhookGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.webhookSecret = config.get("RESEND_WEBHOOK_SECRET", { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request> & Record<string, unknown>>();

    const rawBody = req.rawBody;
    const svixId = req.headers["svix-id"] as string | undefined;
    const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
    const svixSignature = req.headers["svix-signature"] as string | undefined;

    if (!rawBody?.length || !svixId || !svixTimestamp || !svixSignature) {
      this.logger.warn({ msg: "Resend webhook rejected: missing headers or body" });
      throw new BadRequestException("Missing svix headers or body");
    }

    const wh = new Webhook(this.webhookSecret);
    let parsed: unknown;
    try {
      parsed = wh.verify(rawBody as unknown as string, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      this.logger.warn({
        msg: "Resend webhook signature verification failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ForbiddenException("Invalid Resend webhook signature");
    }

    req[RESEND_EVENTS_KEY] = Array.isArray(parsed) ? parsed : [parsed];
    return true;
  }
}
