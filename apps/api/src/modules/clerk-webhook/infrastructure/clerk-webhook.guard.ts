import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Webhook } from "svix";
import type { Env } from "../../../common/config/env.schema";

export const CLERK_EVENT_KEY = "clerkEvent";

@Injectable()
export class ClerkWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ClerkWebhookGuard.name);
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.webhookSecret = config.get("CLERK_WEBHOOK_SECRET", { infer: true });
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
      this.logger.warn({ msg: "Clerk webhook rejected: missing headers or body" });
      throw new BadRequestException("Missing svix headers or body");
    }

    const wh = new Webhook(this.webhookSecret);
    let event: unknown;
    try {
      event = wh.verify(rawBody as unknown as string, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      this.logger.warn({
        msg: "Clerk webhook signature verification failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw new BadRequestException("Invalid Clerk webhook signature");
    }

    req[CLERK_EVENT_KEY] = event;
    return true;
  }
}
