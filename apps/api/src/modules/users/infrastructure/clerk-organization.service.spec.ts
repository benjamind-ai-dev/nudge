import { ClerkOrganizationService } from "./clerk-organization.service";

const mockCreateOrganization = jest.fn();
const mockCreateOrganizationInvitation = jest.fn();
const mockRevokeOrganizationInvitation = jest.fn();
const mockDeleteOrganizationMembership = jest.fn();
const mockCreateOrganizationMembership = jest.fn();

const mockCreateClerkClient = jest.fn<
  {
    organizations: {
      createOrganization: jest.Mock;
      createOrganizationInvitation: jest.Mock;
      revokeOrganizationInvitation: jest.Mock;
      deleteOrganizationMembership: jest.Mock;
      createOrganizationMembership: jest.Mock;
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [any]
>(() => ({
  organizations: {
    createOrganization: mockCreateOrganization,
    createOrganizationInvitation: mockCreateOrganizationInvitation,
    revokeOrganizationInvitation: mockRevokeOrganizationInvitation,
    deleteOrganizationMembership: mockDeleteOrganizationMembership,
    createOrganizationMembership: mockCreateOrganizationMembership,
  },
}));

jest.mock("@clerk/backend", () => ({
  createClerkClient: (opts: unknown) => mockCreateClerkClient(opts),
}));

describe("ClerkOrganizationService", () => {
  let service: ClerkOrganizationService;

  beforeEach(() => {
    mockCreateOrganization.mockReset();
    mockCreateOrganizationInvitation.mockReset();
    mockRevokeOrganizationInvitation.mockReset();
    mockDeleteOrganizationMembership.mockReset();
    mockCreateOrganizationMembership.mockReset();
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
    service = new ClerkOrganizationService(config);
  });

  it("createOrganization calls Clerk with the right shape", async () => {
    mockCreateOrganization.mockResolvedValue({ id: "org_abc" });
    const result = await service.createOrganization({
      name: "Acme",
      ownerClerkUserId: "user_owner",
    });
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: "Acme",
      createdBy: "user_owner",
    });
    expect(result).toEqual({ clerkOrganizationId: "org_abc" });
  });

  it("createOrganizationInvitation calls Clerk with org-scoped params", async () => {
    mockCreateOrganizationInvitation.mockResolvedValue({ id: "orginv_123" });
    const result = await service.createOrganizationInvitation({
      organizationId: "org_abc",
      inviterClerkUserId: "user_owner",
      email: "x@example.com",
      role: "org:member",
      publicMetadata: {
        nudgeAccountId: "acc_1",
        nudgeUserId: "user_1",
        nudgeRole: "viewer",
      },
    });
    expect(mockCreateOrganizationInvitation).toHaveBeenCalledWith({
      organizationId: "org_abc",
      inviterUserId: "user_owner",
      emailAddress: "x@example.com",
      role: "org:member",
      publicMetadata: {
        nudgeAccountId: "acc_1",
        nudgeUserId: "user_1",
        nudgeRole: "viewer",
      },
    });
    expect(result).toEqual({ clerkInvitationId: "orginv_123" });
  });

  it("revokeOrganizationInvitation calls Clerk with organizationId + invitationId", async () => {
    mockRevokeOrganizationInvitation.mockResolvedValue({ id: "orginv_123" });
    await service.revokeOrganizationInvitation({
      organizationId: "org_abc",
      clerkInvitationId: "orginv_123",
    });
    expect(mockRevokeOrganizationInvitation).toHaveBeenCalledWith({
      organizationId: "org_abc",
      invitationId: "orginv_123",
    });
  });

  it("deleteOrganizationMembership calls Clerk with org + user", async () => {
    mockDeleteOrganizationMembership.mockResolvedValue({});
    await service.deleteOrganizationMembership({
      organizationId: "org_abc",
      clerkUserId: "user_member",
    });
    expect(mockDeleteOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_abc",
      userId: "user_member",
    });
  });

  it("createOrganizationMembership calls Clerk with org + user + role", async () => {
    mockCreateOrganizationMembership.mockResolvedValue({});
    await service.createOrganizationMembership({
      organizationId: "org_abc",
      clerkUserId: "user_member",
      role: "org:admin",
    });
    expect(mockCreateOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_abc",
      userId: "user_member",
      role: "org:admin",
    });
  });

  it("propagates SDK errors", async () => {
    mockCreateOrganization.mockRejectedValue(new Error("clerk down"));
    await expect(
      service.createOrganization({ name: "x", ownerClerkUserId: "u" }),
    ).rejects.toThrow("clerk down");
  });
});
