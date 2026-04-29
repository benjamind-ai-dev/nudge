import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { getAuth } from "@clerk/express";
import { Request } from "express";

export const AccountId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const { userId } = getAuth(req);
    if (!userId) {
      throw new UnauthorizedException("No account in session");
    }
    return userId;
  },
);
