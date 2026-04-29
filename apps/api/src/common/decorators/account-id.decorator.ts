import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

export const AccountId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const accountId = (req as unknown as { auth?: { userId?: string } }).auth
      ?.userId;
    if (!accountId) {
      throw new UnauthorizedException("No account in session");
    }
    return accountId;
  },
);
