import { Test } from "@nestjs/testing";
import type { INestApplication, CanActivate, ExecutionContext } from "@nestjs/common";
import request from "supertest";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ProvisionAccountUseCase } from "./application/provision-account.use-case";
import { LinkInvitedUserUseCase } from "./application/link-invited-user.use-case";
import { ClerkWebhookGuard, CLERK_EVENT_KEY } from "./infrastructure/clerk-webhook.guard";
import { PendingUserNotFoundError } from "../users/domain/user.errors";

/**
 * A guard stub that mirrors what the real ClerkWebhookGuard does:
 * it parses the JSON body and stashes it as `req[CLERK_EVENT_KEY]`, then
 * returns true (skipping signature verification in tests).
 */
class TestClerkGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req[CLERK_EVENT_KEY] = (req as { body: unknown }).body;
    return true;
  }
}

describe("ClerkWebhookController (Part 3c branching)", () => {
  let app: INestApplication;
  let provisionUseCase: { execute: jest.Mock };
  let linkUseCase: { execute: jest.Mock };

  const baseUserData = {
    id: "user_clerk_xyz",
    email_addresses: [{ id: "idn_1", email_address: "new@example.com" }],
    primary_email_address_id: "idn_1",
    first_name: "New",
    last_name: "User",
  };

  beforeEach(async () => {
    provisionUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    linkUseCase = { execute: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [ClerkWebhookController],
      providers: [
        { provide: ProvisionAccountUseCase, useValue: provisionUseCase },
        { provide: LinkInvitedUserUseCase, useValue: linkUseCase },
      ],
    })
      .overrideGuard(ClerkWebhookGuard)
      .useClass(TestClerkGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // --- user.created branch ---

  it("fresh signup (empty public_metadata) → ProvisionAccountUseCase, not Link", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({ type: "user.created", data: { ...baseUserData, public_metadata: {} } })
      .expect(200);
    expect(provisionUseCase.execute).toHaveBeenCalled();
    expect(linkUseCase.execute).not.toHaveBeenCalled();
  });

  it("user.created with nudge invitation metadata (legacy path) → LinkInvitedUserUseCase, not Provision", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "user.created",
        data: {
          ...baseUserData,
          public_metadata: { nudgeAccountId: "11111111-1111-1111-1111-111111111111", nudgeUserId: "22222222-2222-2222-2222-222222222222", nudgeRole: "viewer" },
        },
      })
      .expect(200);
    expect(linkUseCase.execute).toHaveBeenCalledWith({
      nudgeAccountId: "11111111-1111-1111-1111-111111111111",
      nudgeUserId: "22222222-2222-2222-2222-222222222222",
      clerkUserId: "user_clerk_xyz",
    });
    expect(provisionUseCase.execute).not.toHaveBeenCalled();
  });

  it("returns 200 when LinkInvitedUserUseCase throws PendingUserNotFoundError (legacy user.created path)", async () => {
    linkUseCase.execute.mockRejectedValue(new PendingUserNotFoundError("user_1"));
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "user.created",
        data: {
          ...baseUserData,
          public_metadata: { nudgeAccountId: "11111111-1111-1111-1111-111111111111", nudgeUserId: "22222222-2222-2222-2222-222222222222", nudgeRole: "viewer" },
        },
      })
      .expect(200);
  });

  it("ignores non-user.created and non-membership.created event types", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({ type: "user.updated", data: { foo: "bar" } })
      .expect(200);
    expect(provisionUseCase.execute).not.toHaveBeenCalled();
    expect(linkUseCase.execute).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed user.created (e.g. missing email_addresses)", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({ type: "user.created", data: { id: "u" } })
      .expect(400);
  });

  it("falls through to ProvisionAccountUseCase when public_metadata is partial/malformed", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "user.created",
        data: {
          ...baseUserData,
          // Missing nudgeUserId and nudgeRole — should NOT satisfy nudgeInvitationMetadataSchema.
          public_metadata: { nudgeAccountId: "11111111-1111-1111-1111-111111111111" },
        },
      })
      .expect(200);
    expect(linkUseCase.execute).not.toHaveBeenCalled();
    expect(provisionUseCase.execute).toHaveBeenCalled();
  });

  // --- organizationMembership.created branch ---

  it("organizationMembership.created with nudge metadata → LinkInvitedUserUseCase with new member's clerkUserId", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "organizationMembership.created",
        data: {
          organization: { id: "org_abc" },
          public_user_data: { user_id: "user_invitee_clerk" },
          public_metadata: {
            nudgeAccountId: "00000000-0000-0000-0000-000000000001",
            nudgeUserId: "00000000-0000-0000-0000-000000000002",
            nudgeRole: "viewer",
          },
        },
      })
      .expect(200);
    expect(linkUseCase.execute).toHaveBeenCalledWith({
      nudgeAccountId: "00000000-0000-0000-0000-000000000001",
      nudgeUserId: "00000000-0000-0000-0000-000000000002",
      clerkUserId: "user_invitee_clerk",
    });
    expect(provisionUseCase.execute).not.toHaveBeenCalled();
  });

  it("organizationMembership.created without nudge metadata (org member added outside our flow) → ack without calling LinkInvitedUserUseCase", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "organizationMembership.created",
        data: {
          organization: { id: "org_abc" },
          public_user_data: { user_id: "user_x" },
          public_metadata: {},
        },
      })
      .expect(200);
    expect(linkUseCase.execute).not.toHaveBeenCalled();
    expect(provisionUseCase.execute).not.toHaveBeenCalled();
  });

  it("organizationMembership.created — returns 200 when LinkInvitedUserUseCase throws PendingUserNotFoundError", async () => {
    linkUseCase.execute.mockRejectedValue(new PendingUserNotFoundError("user_2"));
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "organizationMembership.created",
        data: {
          organization: { id: "org_abc" },
          public_user_data: { user_id: "user_invitee_clerk" },
          public_metadata: {
            nudgeAccountId: "00000000-0000-0000-0000-000000000001",
            nudgeUserId: "00000000-0000-0000-0000-000000000002",
            nudgeRole: "viewer",
          },
        },
      })
      .expect(200);
  });

  it("organizationMembership.created — returns 400 when payload is malformed (missing organization)", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({
        type: "organizationMembership.created",
        data: {
          // missing organization key
          public_user_data: { user_id: "user_x" },
          public_metadata: {},
        },
      })
      .expect(400);
  });
});
