import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import {
  INTUIT_SIGNATURE_VERIFIER,
  type IntuitSignatureVerifier,
} from "./intuit-signature.verifier";

const SIGNATURE_HEADER = "intuit-signature";

@Injectable()
export class IntuitSignatureGuard implements CanActivate {
  private readonly logger = new Logger(IntuitSignatureGuard.name);

  constructor(
    @Inject(INTUIT_SIGNATURE_VERIFIER)
    private readonly verifier: IntuitSignatureVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();

    const rawBody = req.rawBody;
    const headerValue = req.headers?.[SIGNATURE_HEADER];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!signature) {
      this.reject("missing_signature");
    }
    if (!rawBody?.length) {
      this.reject("missing_body");
    }
    if (!this.verifier.verify(rawBody as Buffer, signature as string)) {
      this.reject("signature_mismatch");
    }
    return true;
  }

  private reject(reason: string): never {
    this.logger.warn({
      msg: "QB webhook rejected by signature guard",
      event: "qb_webhook_unauthorized",
      reason,
    });
    throw new ForbiddenException();
  }
}
