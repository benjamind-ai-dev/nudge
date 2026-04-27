import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  RawBodyRequest,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  XERO_SIGNATURE_VERIFIER,
  type XeroSignatureVerifier,
} from "./xero-signature.verifier";

const SIGNATURE_HEADER = "x-xero-signature";

@Injectable()
export class XeroSignatureGuard implements CanActivate {
  private readonly logger = new Logger(XeroSignatureGuard.name);

  constructor(
    @Inject(XERO_SIGNATURE_VERIFIER)
    private readonly verifier: XeroSignatureVerifier,
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
      msg: "Xero webhook rejected by signature guard",
      event: "xero_webhook_unauthorized",
      reason,
    });
    throw new UnauthorizedException();
  }
}
