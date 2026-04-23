import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { BusinessController } from "./business.controller";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { BusinessNotFoundError } from "./domain/business.errors";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440001";

const businessWithConnections = {
  id: BIZ_ID,
  name: "Acme Corp",
  accountingProvider: "quickbooks",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
  isActive: true,
  customerCount: 5,
  invoiceCount: 12,
  connections: [{ provider: "quickbooks", status: "active", lastSyncAt: null }],
};

const businessSettings = {
  id: BIZ_ID,
  name: "Acme Corp",
  senderName: "Acme Billing",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
};

describe("BusinessController", () => {
  let app: INestApplication;
  let getUseCase: { execute: jest.Mock };
  let createUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let deleteUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    getUseCase = { execute: jest.fn() };
    createUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        { provide: GetBusinessUseCase, useValue: getUseCase },
        { provide: CreateBusinessUseCase, useValue: createUseCase },
        { provide: UpdateBusinessSettingsUseCase, useValue: updateUseCase },
        { provide: DeleteBusinessUseCase, useValue: deleteUseCase },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /v1/businesses/:id returns 200 with business + connections", async () => {
    getUseCase.execute.mockResolvedValue(businessWithConnections);
    await request(app.getHttpServer())
      .get(`/v1/businesses/${BIZ_ID}`)
      .expect(200, { data: businessWithConnections });
  });

  it("GET /v1/businesses/:id returns 404 when not found", async () => {
    getUseCase.execute.mockRejectedValue(new BusinessNotFoundError(BIZ_ID));
    await request(app.getHttpServer())
      .get(`/v1/businesses/${BIZ_ID}`)
      .expect(404);
  });

  it("POST /v1/businesses returns 201 with created business", async () => {
    createUseCase.execute.mockResolvedValue(businessWithConnections);
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        accountId: ACCOUNT_ID,
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Acme Billing",
        senderEmail: "billing@acme.com",
        timezone: "America/New_York",
      })
      .expect(201, { data: businessWithConnections });
  });

  it("POST /v1/businesses returns 400 for invalid accountingProvider", async () => {
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        accountId: ACCOUNT_ID,
        name: "Acme Corp",
        accountingProvider: "sage",
        senderName: "Acme Billing",
        senderEmail: "billing@acme.com",
        timezone: "America/New_York",
      })
      .expect(400);
  });

  it("POST /v1/businesses returns 400 for invalid senderEmail", async () => {
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        accountId: ACCOUNT_ID,
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Acme Billing",
        senderEmail: "not-an-email",
        timezone: "America/New_York",
      })
      .expect(400);
  });

  it("POST /v1/businesses returns 400 for invalid timezone", async () => {
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        accountId: ACCOUNT_ID,
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Acme Billing",
        senderEmail: "billing@acme.com",
        timezone: "Not/ATimezone",
      })
      .expect(400);
  });

  it("PATCH /v1/businesses/:id returns 200 with updated settings", async () => {
    updateUseCase.execute.mockResolvedValue(businessSettings);
    await request(app.getHttpServer())
      .patch(`/v1/businesses/${BIZ_ID}`)
      .send({ senderName: "New Name" })
      .expect(200, { data: businessSettings });
  });

  it("PATCH /v1/businesses/:id returns 404 when not found", async () => {
    updateUseCase.execute.mockRejectedValue(new BusinessNotFoundError(BIZ_ID));
    await request(app.getHttpServer())
      .patch(`/v1/businesses/${BIZ_ID}`)
      .send({ senderName: "New Name" })
      .expect(404);
  });

  it("PATCH /v1/businesses/:id returns 400 for invalid senderEmail", async () => {
    await request(app.getHttpServer())
      .patch(`/v1/businesses/${BIZ_ID}`)
      .send({ senderEmail: "not-an-email" })
      .expect(400);
  });

  it("PATCH /v1/businesses/:id returns 400 for invalid timezone", async () => {
    await request(app.getHttpServer())
      .patch(`/v1/businesses/${BIZ_ID}`)
      .send({ timezone: "Not/ATimezone" })
      .expect(400);
  });

  it("DELETE /v1/businesses/:id returns 204", async () => {
    deleteUseCase.execute.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .delete(`/v1/businesses/${BIZ_ID}`)
      .expect(204);
  });

  it("DELETE /v1/businesses/:id returns 404 when not found", async () => {
    deleteUseCase.execute.mockRejectedValue(new BusinessNotFoundError(BIZ_ID));
    await request(app.getHttpServer())
      .delete(`/v1/businesses/${BIZ_ID}`)
      .expect(404);
  });
});
