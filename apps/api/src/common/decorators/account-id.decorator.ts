import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

type ClerkRequest = Request & { auth: () => { userId?: string | null } };

export const AccountId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<ClerkRequest>();
    const userId = req.auth?.()?.userId;
    if (!userId) {
      throw new UnauthorizedException("No account in session");
    }
    return userId;
  },
);
