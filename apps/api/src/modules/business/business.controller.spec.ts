import { Test } from "@nestjs/testing";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { BusinessController } from "./business.controller";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { TriggerManualSyncUseCase } from "./application/trigger-manual-sync.use-case";
import { ListBusinessesUseCase } from "./application/list-businesses.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import {
  BusinessNotFoundError,
  NoActiveConnectionError,
  SyncRateLimitedError,
} from "./domain/business.errors";

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
  let listUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let deleteUseCase: { execute: jest.Mock };
  let triggerSyncUseCase: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };
  let callerCtx: { resolve: jest.Mock };

  beforeEach(async () => {
    getUseCase = { execute: jest.fn() };
    createUseCase = { execute: jest.fn() };
    listUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    triggerSyncUseCase = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };
    callerCtx = {
      resolve: jest
        .fn()
        .mockResolvedValue({ userId: "user-1", accountId: ACCOUNT_ID, role: "owner" }),
    };

    const module = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        { provide: GetBusinessUseCase, useValue: getUseCase },
        { provide: CreateBusinessUseCase, useValue: createUseCase },
        { provide: ListBusinessesUseCase, useValue: listUseCase },
        { provide: UpdateBusinessSettingsUseCase, useValue: updateUseCase },
        { provide: DeleteBusinessUseCase, useValue: deleteUseCase },
        { provide: TriggerManualSyncUseCase, useValue: triggerSyncUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
        { provide: CallerContextService, useValue: callerCtx },
      ],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalFilters(new GlobalExceptionFilter());
    // Stub Clerk auth — @AccountId() reads req.auth().userId.
    app.use((req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
      req.auth = () => ({ userId: "user_test_123" });
      next();
    });
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

  it("POST /v1/businesses returns 201 with created business and uses caller's accountId", async () => {
    createUseCase.execute.mockResolvedValue(businessWithConnections);
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Acme Billing",
        senderEmail: "billing@acme.com",
        timezone: "America/New_York",
      })
      .expect(201, { data: businessWithConnections });
    expect(createUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, name: "Acme Corp" }),
    );
  });

  it("POST /v1/businesses returns 401 when caller is not provisioned", async () => {
    callerCtx.resolve.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
        name: "Acme Corp",
        accountingProvider: "quickbooks",
        senderName: "Acme Billing",
        senderEmail: "billing@acme.com",
        timezone: "America/New_York",
      })
      .expect(401);
    expect(createUseCase.execute).not.toHaveBeenCalled();
  });

  it("POST /v1/businesses returns 400 for invalid accountingProvider", async () => {
    await request(app.getHttpServer())
      .post("/v1/businesses")
      .send({
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

  it("DELETE /v1/businesses/:id returns 401 when unauthenticated", async () => {
    // Build a separate app without the auth stub middleware.
    const module = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        { provide: GetBusinessUseCase, useValue: getUseCase },
        { provide: CreateBusinessUseCase, useValue: createUseCase },
        { provide: ListBusinessesUseCase, useValue: listUseCase },
        { provide: UpdateBusinessSettingsUseCase, useValue: updateUseCase },
        { provide: DeleteBusinessUseCase, useValue: deleteUseCase },
        { provide: TriggerManualSyncUseCase, useValue: triggerSyncUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
        { provide: CallerContextService, useValue: callerCtx },
      ],
    }).compile();
    const unauthApp = module.createNestApplication();
    unauthApp.useGlobalFilters(new GlobalExceptionFilter());
    await unauthApp.init();
    await request(unauthApp.getHttpServer())
      .delete(`/v1/businesses/${BIZ_ID}`)
      .expect(401);
    await unauthApp.close();
  });

  it("POST /v1/businesses/:id/sync returns 202 with jobId on success", async () => {
    triggerSyncUseCase.execute.mockResolvedValue({
      message: "Sync queued",
      jobId: "job-abc",
    });
    await request(app.getHttpServer())
      .post(`/v1/businesses/${BIZ_ID}/sync`)
      .send({})
      .expect(202, { data: { message: "Sync queued", jobId: "job-abc" } });
    expect(triggerSyncUseCase.execute).toHaveBeenCalledWith(BIZ_ID);
  });

  it("POST /v1/businesses/:id/sync returns 404 when business not found", async () => {
    triggerSyncUseCase.execute.mockRejectedValue(
      new BusinessNotFoundError(BIZ_ID),
    );
    await request(app.getHttpServer())
      .post(`/v1/businesses/${BIZ_ID}/sync`)
      .send({})
      .expect(404);
  });

  it("POST /v1/businesses/:id/sync returns 409 when no active connection", async () => {
    triggerSyncUseCase.execute.mockRejectedValue(
      new NoActiveConnectionError(BIZ_ID),
    );
    await request(app.getHttpServer())
      .post(`/v1/businesses/${BIZ_ID}/sync`)
      .send({})
      .expect(409);
  });

  it("POST /v1/businesses/:id/sync returns 429 with retryAfterSeconds when rate-limited", async () => {
    triggerSyncUseCase.execute.mockRejectedValue(
      new SyncRateLimitedError(BIZ_ID, 200),
    );
    const res = await request(app.getHttpServer())
      .post(`/v1/businesses/${BIZ_ID}/sync`)
      .send({})
      .expect(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      retryAfterSeconds: 200,
    });
  });

  it("POST /v1/businesses/:id/sync returns 401 when unauthenticated", async () => {
    // Build a separate app without the auth stub middleware.
    const module = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        { provide: GetBusinessUseCase, useValue: getUseCase },
        { provide: CreateBusinessUseCase, useValue: createUseCase },
        { provide: ListBusinessesUseCase, useValue: listUseCase },
        { provide: UpdateBusinessSettingsUseCase, useValue: updateUseCase },
        { provide: DeleteBusinessUseCase, useValue: deleteUseCase },
        { provide: TriggerManualSyncUseCase, useValue: triggerSyncUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
        { provide: CallerContextService, useValue: callerCtx },
      ],
    }).compile();
    const unauthApp = module.createNestApplication();
    unauthApp.useGlobalFilters(new GlobalExceptionFilter());
    await unauthApp.init();
    await request(unauthApp.getHttpServer())
      .post(`/v1/businesses/${BIZ_ID}/sync`)
      .send({})
      .expect(401);
    await unauthApp.close();
  });

  it("GET /v1/businesses returns 200 with the account's businesses", async () => {
    listUseCase.execute.mockResolvedValue([businessWithConnections]);
    await request(app.getHttpServer())
      .get("/v1/businesses")
      .expect(200, { data: [businessWithConnections] });
    expect(listUseCase.execute).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("GET /v1/businesses returns 401 when caller is not provisioned", async () => {
    callerCtx.resolve.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get("/v1/businesses")
      .expect(401);
    expect(listUseCase.execute).not.toHaveBeenCalled();
  });

  it("GET /v1/businesses/:id returns 404 when business belongs to a different account", async () => {
    businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
      new BusinessNotFoundError(BIZ_ID),
    );

    await request(app.getHttpServer())
      .get(`/v1/businesses/${BIZ_ID}`)
      .expect(404);

    expect(getUseCase.execute).not.toHaveBeenCalled();
  });
});
