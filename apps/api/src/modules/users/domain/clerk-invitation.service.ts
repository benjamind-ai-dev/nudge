export interface CreateInvitationParams {
  organizationId: string;
  inviterClerkUserId: string | null;
  email: string;
  accountId: string;
  userId: string;
  role: "admin" | "viewer";
}

export interface CreateInvitationResult {
  clerkInvitationId: string;
}

export interface RevokeInvitationParams {
  organizationId: string;
  clerkInvitationId: string;
}

export interface ClerkInvitationService {
  createInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult>;
  revokeInvitation(params: RevokeInvitationParams): Promise<void>;
}

export const CLERK_INVITATION_SERVICE = Symbol("ClerkInvitationService");
