export interface CreateInvitationParams {
  email: string;
  accountId: string;
  userId: string;
  role: "admin" | "viewer";
}

export interface CreateInvitationResult {
  clerkInvitationId: string;
}

export interface ClerkInvitationService {
  createInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult>;
}

export const CLERK_INVITATION_SERVICE = Symbol("ClerkInvitationService");
