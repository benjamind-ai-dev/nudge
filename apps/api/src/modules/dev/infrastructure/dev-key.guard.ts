import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../../common/config/env.schema";

const DEV_KEY_HEADER = "x-dev-key";

@Injectable()
export class DevKeyGuard implements CanActivate {
  private readonly logger = new Logger(DevKeyGuard.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const devMode = this.config.get("DEV_MODE", { infer: true });
    if (!devMode) {
      throw new NotFoundException();
    }

    const expected = this.config.get("DEV_API_KEY", { infer: true });
    if (!expected) {
      this.logger.error({
        msg: "DEV_MODE is true but DEV_API_KEY is not set; refusing request",
        event: "dev_key_misconfigured",
      });
      throw new NotFoundException();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers[DEV_KEY_HEADER];
    const providedStr = Array.isArray(provided) ? provided[0] : provided;

    if (!providedStr || providedStr !== expected) {
      this.logger.warn({
        msg: "Dev endpoint rejected: bad or missing X-Dev-Key",
        event: "dev_key_rejected",
        path: req.path,
      });
      throw new UnauthorizedException("Invalid X-Dev-Key");
    }

    this.logger.warn({
      msg: "Dev endpoint hit",
      event: "dev_endpoint_hit",
      path: req.path,
    });
    return true;
  }
}
