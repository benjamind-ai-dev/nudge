export interface CreateOrganizationParams {
  name: string;
  ownerClerkUserId: string;
}

export interface CreateOrganizationResult {
  clerkOrganizationId: string;
}

export interface CreateOrganizationInvitationParams {
  organizationId: string;
  inviterClerkUserId: string | null;
  email: string;
  role: "org:admin" | "org:member";
  publicMetadata: {
    nudgeAccountId: string;
    nudgeUserId: string;
    nudgeRole: "admin" | "viewer";
  };
}

export interface CreateOrganizationInvitationResult {
  clerkInvitationId: string;
}

export interface RevokeOrganizationInvitationParams {
  organizationId: string;
  clerkInvitationId: string;
}

export interface DeleteOrganizationMembershipParams {
  organizationId: string;
  clerkUserId: string;
}

export interface CreateOrganizationMembershipParams {
  organizationId: string;
  clerkUserId: string;
  role: "org:admin" | "org:member";
}

export interface ClerkOrganizationService {
  createOrganization(p: CreateOrganizationParams): Promise<CreateOrganizationResult>;
  createOrganizationInvitation(
    p: CreateOrganizationInvitationParams,
  ): Promise<CreateOrganizationInvitationResult>;
  revokeOrganizationInvitation(p: RevokeOrganizationInvitationParams): Promise<void>;
  deleteOrganizationMembership(p: DeleteOrganizationMembershipParams): Promise<void>;
  createOrganizationMembership(p: CreateOrganizationMembershipParams): Promise<void>;
}

export const CLERK_ORGANIZATION_SERVICE = Symbol("ClerkOrganizationService");
