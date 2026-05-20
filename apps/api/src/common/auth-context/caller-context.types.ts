import { z } from "zod";

export const userRoleSchema = z.enum(["owner", "admin", "viewer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export interface CallerContext {
  userId: string;
  accountId: string;
  role: UserRole;
}

export interface CallerContextRepository {
  findByClerkUserId(clerkUserId: string): Promise<{
    userId: string;
    accountId: string;
    role: string;
  } | null>;
}

export const CALLER_CONTEXT_REPOSITORY = Symbol("CallerContextRepository");
