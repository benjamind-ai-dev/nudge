import { Inject, Injectable } from "@nestjs/common";
import {
  CALLER_CONTEXT_REPOSITORY,
  CallerContext,
  CallerContextRepository,
  userRoleSchema,
} from "./caller-context.types";

@Injectable()
export class CallerContextService {
  constructor(
    @Inject(CALLER_CONTEXT_REPOSITORY)
    private readonly repo: CallerContextRepository,
  ) {}

  async resolve(clerkUserId: string): Promise<CallerContext | null> {
    const row = await this.repo.findByClerkUserId(clerkUserId);
    if (!row) return null;

    const roleParsed = userRoleSchema.safeParse(row.role);
    if (!roleParsed.success) {
      throw new Error(
        `Invalid role "${row.role}" for user ${row.userId} — DB role does not match allowed values`,
      );
    }

    return {
      userId: row.userId,
      accountId: row.accountId,
      role: roleParsed.data,
    };
  }
}
