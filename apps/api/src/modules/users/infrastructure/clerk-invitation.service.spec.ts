import { ClerkInvitationService } from "./clerk-invitation.service";

const mockCreateInvitation = jest.fn();
const mockRevokeInvitation = jest.fn();
const mockCreateClerkClient = jest.fn<
  { invitations: { createInvitation: jest.Mock; revokeInvitation: jest.Mock } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [any]
>(() => ({
  invitations: {
    createInvitation: mockCreateInvitation,
    revokeInvitation: mockRevokeInvitation,
  },
}));

jest.mock("@clerk/backend", () => ({
  createClerkClient: (opts: unknown) => mockCreateClerkClient(opts),
}));

describe("ClerkInvitationService", () => {
  let service: ClerkInvitationService;

  beforeEach(() => {
    mockCreateInvitation.mockReset();
    mockRevokeInvitation.mockReset();
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

  it("calls clerkClient.invitations.createInvitation with the right shape", async () => {
    mockCreateInvitation.mockResolvedValue({ id: "inv_abc" });

    const result = await service.createInvitation({
      email: "x@example.com",
      accountId: "acc_1",
      userId: "user_1",
      role: "viewer",
    });

    expect(mockCreateInvitation).toHaveBeenCalledWith({
      emailAddress: "x@example.com",
      publicMetadata: {
        nudgeAccountId: "acc_1",
        nudgeUserId: "user_1",
        nudgeRole: "viewer",
      },
    });
    expect(result).toEqual({ clerkInvitationId: "inv_abc" });
  });

  it("propagates SDK errors", async () => {
    mockCreateInvitation.mockRejectedValue(new Error("clerk down"));
    await expect(
      service.createInvitation({
        email: "x@example.com",
        accountId: "acc_1",
        userId: "user_1",
        role: "admin",
      }),
    ).rejects.toThrow("clerk down");
  });

  it("calls clerkClient.invitations.revokeInvitation with the string-form invitationId", async () => {
    mockRevokeInvitation.mockResolvedValue({ id: "inv_abc" });
    await service.revokeInvitation({ clerkInvitationId: "inv_abc" });
    // The Clerk Backend SDK v3 revokeInvitation() takes a plain string (not object form)
    expect(mockRevokeInvitation).toHaveBeenCalledWith("inv_abc");
  });

  it("propagates SDK errors from revokeInvitation", async () => {
    mockRevokeInvitation.mockRejectedValue(new Error("clerk down"));
    await expect(
      service.revokeInvitation({ clerkInvitationId: "inv_abc" }),
    ).rejects.toThrow("clerk down");
  });
});
