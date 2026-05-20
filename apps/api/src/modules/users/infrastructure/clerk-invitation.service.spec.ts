import { ClerkInvitationService } from "./clerk-invitation.service";

const mockCreateOrgInvitation = jest.fn();
const mockRevokeOrgInvitation = jest.fn();
const mockCreateClerkClient = jest.fn<
  { organizations: { createOrganizationInvitation: jest.Mock; revokeOrganizationInvitation: jest.Mock } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [any]
>(() => ({
  organizations: {
    createOrganizationInvitation: mockCreateOrgInvitation,
    revokeOrganizationInvitation: mockRevokeOrgInvitation,
  },
}));

jest.mock("@clerk/backend", () => ({
  createClerkClient: (opts: unknown) => mockCreateClerkClient(opts),
}));

describe("ClerkInvitationService", () => {
  let service: ClerkInvitationService;

  beforeEach(() => {
    mockCreateOrgInvitation.mockReset();
    mockRevokeOrgInvitation.mockReset();
    mockCreateClerkClient.mockClear();
    const config = {
      get: jest.fn((key: string) => {
        if (key === "CLERK_SECRET_KEY") return "sk_test_xxx";
        throw new Error(`unexpected config key ${key}`);
      }),
    } as unknown as import("@nestjs/config").ConfigService<
      import("../../../common/config/env.schema").Env,
      true
    >;
    service = new ClerkInvitationService(config);
  });

  it("constructs the Clerk client with the secret from config", () => {
    expect(mockCreateClerkClient).toHaveBeenCalledWith({ secretKey: "sk_test_xxx" });
  });

  it("calls clerkClient.organizations.createOrganizationInvitation with the right shape", async () => {
    mockCreateOrgInvitation.mockResolvedValue({ id: "orginv_abc" });

    const result = await service.createInvitation({
      organizationId: "org_acme",
      inviterClerkUserId: "user_owner",
      email: "x@example.com",
      accountId: "acc_1",
      userId: "user_1",
      role: "viewer",
    });

    expect(mockCreateOrgInvitation).toHaveBeenCalledWith({
      organizationId: "org_acme",
      inviterUserId: "user_owner",
      emailAddress: "x@example.com",
      role: "org:member",
      publicMetadata: {
        nudgeAccountId: "acc_1",
        nudgeUserId: "user_1",
        nudgeRole: "viewer",
      },
    });
    expect(result).toEqual({ clerkInvitationId: "orginv_abc" });
  });

  it("maps admin role to org:admin", async () => {
    mockCreateOrgInvitation.mockResolvedValue({ id: "orginv_admin" });

    await service.createInvitation({
      organizationId: "org_acme",
      inviterClerkUserId: "user_owner",
      email: "admin@example.com",
      accountId: "acc_1",
      userId: "user_2",
      role: "admin",
    });

    expect(mockCreateOrgInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ role: "org:admin" }),
    );
  });

  it("propagates SDK errors from createInvitation", async () => {
    mockCreateOrgInvitation.mockRejectedValue(new Error("clerk down"));
    await expect(
      service.createInvitation({
        organizationId: "org_acme",
        inviterClerkUserId: "user_owner",
        email: "x@example.com",
        accountId: "acc_1",
        userId: "user_1",
        role: "admin",
      }),
    ).rejects.toThrow("clerk down");
  });

  it("revokes the org-scoped invitation", async () => {
    mockRevokeOrgInvitation.mockResolvedValue({});
    await service.revokeInvitation({
      organizationId: "org_acme",
      clerkInvitationId: "orginv_abc",
    });
    expect(mockRevokeOrgInvitation).toHaveBeenCalledWith({
      organizationId: "org_acme",
      invitationId: "orginv_abc",
    });
  });

  it("propagates SDK errors from revokeInvitation", async () => {
    mockRevokeOrgInvitation.mockRejectedValue(new Error("clerk down"));
    await expect(
      service.revokeInvitation({ organizationId: "org_acme", clerkInvitationId: "orginv_abc" }),
    ).rejects.toThrow("clerk down");
  });
});
