import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ConnectionsController } from "./connections.controller";
import { StartConnectionUseCase } from "../connections-common/application/start-connection.use-case";
import { BusinessNotFoundError } from "../connections-common/domain/connection.errors";

describe("ConnectionsController", () => {
  let app: INestApplication;
  let useCase: { execute: jest.Mock };

  beforeEach(async () => {
    useCase = { execute: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ConnectionsController],
      providers: [{ provide: StartConnectionUseCase, useValue: useCase }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with oauthUrl for a valid Xero request", async () => {
    useCase.execute.mockResolvedValue({ oauthUrl: "https://login.xero.com/..." });

    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({
        businessId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "xero",
      })
      .expect(200, { data: { oauthUrl: "https://login.xero.com/..." } });
  });

  it("returns 200 with oauthUrl for a valid QuickBooks request", async () => {
    useCase.execute.mockResolvedValue({ oauthUrl: "https://appcenter.intuit.com/..." });

    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({
        businessId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "quickbooks",
      })
      .expect(200);
  });

  it("returns 400 when businessId is not a UUID", async () => {
    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({ businessId: "nope", provider: "xero" })
      .expect(400);
  });

  it("returns 400 when provider is not in the enum", async () => {
    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({
        businessId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "sage",
      })
      .expect(400);
  });

  it("returns 404 when business does not exist", async () => {
    useCase.execute.mockRejectedValue(
      new BusinessNotFoundError("550e8400-e29b-41d4-a716-446655440000"),
    );

    await request(app.getHttpServer())
      .post("/v1/connections/authorize")
      .send({
        businessId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "xero",
      })
      .expect(404);
  });
});
