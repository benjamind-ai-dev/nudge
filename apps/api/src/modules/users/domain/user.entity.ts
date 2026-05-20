import { UserRole } from "../../../common/auth-context/caller-context.types";

export interface UserListItem {
  id: string;
  accountId: string;
  email: string;
  name: string;
  role: UserRole;
  lastLoginAt: Date | null;
  clerkUserId: string | null;
  clerkInvitationId: string | null;
}
