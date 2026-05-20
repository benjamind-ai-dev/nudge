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

  it("fresh signup (empty public_metadata) → ProvisionAccountUseCase, not Link", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/clerk")
      .send({ type: "user.created", data: { ...baseUserData, public_metadata: {} } })
      .expect(200);
    expect(provisionUseCase.execute).toHaveBeenCalled();
    expect(linkUseCase.execute).not.toHaveBeenCalled();
  });

  it("invitation acceptance → LinkInvitedUserUseCase, not Provision", async () => {
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

  it("returns 200 (does not 4xx/5xx) when LinkInvitedUserUseCase throws PendingUserNotFoundError", async () => {
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

  it("ignores non-user.created event types", async () => {
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
});
