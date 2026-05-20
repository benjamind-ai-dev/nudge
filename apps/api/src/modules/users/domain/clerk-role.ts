import type { UserRole } from "../../../common/auth-context/caller-context.types";

export type ClerkOrgRole = "org:admin" | "org:member";

/**
 * Maps Nudge's role enum to Clerk's default org role strings.
 * - owner / admin → org:admin (Nudge admins can invite, matching Clerk admin)
 * - viewer        → org:member
 */
export function mapNudgeRoleToClerkRole(role: UserRole): ClerkOrgRole {
  if (role === "owner" || role === "admin") return "org:admin";
  return "org:member";
}
