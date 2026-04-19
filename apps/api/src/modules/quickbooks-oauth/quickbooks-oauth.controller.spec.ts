import { Test } from "@nestjs/testing";
import { INestApplication, NotFoundException } from "@nestjs/common";
import request from "supertest";
import { QuickbooksOAuthController } from "./quickbooks-oauth.controller";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";

describe("QuickbooksOAuthController", () => {
  let app: INestApplication;
  let service: { authorize: jest.Mock; callback: jest.Mock };

  beforeEach(async () => {
    service = {
      authorize: jest.fn(),
      callback: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [QuickbooksOAuthController],
      providers: [
        { provide: QuickbooksOAuthService, useValue: service },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /v1/connections/quickbooks/authorize", () => {
    it("returns 200 with oauthUrl", async () => {
      const oauthUrl = "https://appcenter.intuit.com/connect/oauth2?state=abc";
      service.authorize.mockResolvedValue({ oauthUrl });

      const response = await request(app.getHttpServer())
        .post("/v1/connections/quickbooks/authorize")
        .send({ businessId: "550e8400-e29b-41d4-a716-446655440000" })
        .expect(200);

      expect(response.body).toEqual({ data: { oauthUrl } });
    });

    it("returns 400 on invalid businessId", async () => {
      await request(app.getHttpServer())
        .post("/v1/connections/quickbooks/authorize")
        .send({ businessId: "not-a-uuid" })
        .expect(400);
    });

    it("returns 404 when business not found", async () => {
      service.authorize.mockRejectedValue(
        new NotFoundException("Business not found"),
      );

      await request(app.getHttpServer())
        .post("/v1/connections/quickbooks/authorize")
        .send({ businessId: "550e8400-e29b-41d4-a716-446655440000" })
        .expect(404);
    });
  });

  describe("GET /v1/connections/quickbooks/callback", () => {
    it("redirects to success URL", async () => {
      const redirectUrl =
        "http://localhost:5173/onboarding/complete?status=success";
      service.callback.mockResolvedValue(redirectUrl);

      await request(app.getHttpServer())
        .get("/v1/connections/quickbooks/callback")
        .query({ code: "auth-code", state: "state-token", realmId: "realm-1" })
        .expect(302)
        .expect("Location", redirectUrl);
    });

    it("redirects to error URL on invalid state", async () => {
      const errorUrl =
        "http://localhost:5173/onboarding/complete?status=error&reason=invalid_state";
      service.callback.mockResolvedValue(errorUrl);

      await request(app.getHttpServer())
        .get("/v1/connections/quickbooks/callback")
        .query({ code: "auth-code", state: "bad-state", realmId: "realm-1" })
        .expect(302)
        .expect("Location", errorUrl);
    });
  });
});
