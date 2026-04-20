import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { XeroCallbackController } from "./xero-callback.controller";
import { CompleteConnectionUseCase } from "../connections-common/application/complete-connection.use-case";

describe("XeroCallbackController", () => {
  let app: INestApplication;
  let useCase: { execute: jest.Mock };

  beforeEach(async () => {
    useCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [XeroCallbackController],
      providers: [{ provide: CompleteConnectionUseCase, useValue: useCase }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("redirects to the URL returned by the use case", async () => {
    useCase.execute.mockResolvedValue({
      redirectUrl: "http://localhost:5173/onboarding/complete?status=success",
    });

    await request(app.getHttpServer())
      .get("/v1/connections/xero/callback")
      .query({ code: "c", state: "s" })
      .expect(302)
      .expect(
        "Location",
        "http://localhost:5173/onboarding/complete?status=success",
      );
  });

  it("delegates to CompleteConnectionUseCase with provider hint xero and empty metadata", async () => {
    useCase.execute.mockResolvedValue({ redirectUrl: "http://x" });

    await request(app.getHttpServer())
      .get("/v1/connections/xero/callback")
      .query({ code: "c", state: "s" })
      .expect(302);

    expect(useCase.execute).toHaveBeenCalledWith({
      code: "c",
      state: "s",
      providerHint: "xero",
      providerMetadata: {},
    });
  });
});
