import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { QuickbooksOAuthController } from "./quickbooks-oauth.controller";
import { CompleteConnectionUseCase } from "../connections-common/application/complete-connection.use-case";

describe("QuickbooksOAuthController", () => {
  let app: INestApplication;
  let useCase: { execute: jest.Mock };

  beforeEach(async () => {
    useCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [QuickbooksOAuthController],
      providers: [
        { provide: CompleteConnectionUseCase, useValue: useCase },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("redirects to success URL", async () => {
    useCase.execute.mockResolvedValue({
      redirectUrl: "http://localhost:5173/onboarding/complete?status=success",
    });

    await request(app.getHttpServer())
      .get("/v1/connections/quickbooks/callback")
      .query({ code: "c", state: "s", realmId: "r" })
      .expect(302)
      .expect(
        "Location",
        "http://localhost:5173/onboarding/complete?status=success",
      );
  });

  it("delegates to CompleteConnectionUseCase with realmId metadata", async () => {
    useCase.execute.mockResolvedValue({ redirectUrl: "http://x" });

    await request(app.getHttpServer())
      .get("/v1/connections/quickbooks/callback")
      .query({ code: "c", state: "s", realmId: "r" })
      .expect(302);

    expect(useCase.execute).toHaveBeenCalledWith({
      code: "c",
      state: "s",
      providerHint: "quickbooks",
      providerMetadata: { realmId: "r" },
    });
  });
});
