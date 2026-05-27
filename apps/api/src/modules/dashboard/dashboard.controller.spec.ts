import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DashboardController } from "./dashboard.controller";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
import { GetNeedsAttentionUseCase } from "./application/get-needs-attention.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";

const BIZ_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "user_AAA";

const SAMPLE_SUMMARY = {
  outstanding: { totalCents: 250_000, count: 5 },
  recoveredThisMonth: { totalCents: 120_000, pctChangeVsLastMonth: 18.2 },
  avgDaysToPay: { currentDays: 12, previousDays: 15 },
  activeSequences: { count: 7 },
  aging: {
    current: { totalCents: 50_000, count: 2 },
    days1to30: { totalCents: 80_000, count: 2 },
    days31to60: { totalCents: 70_000, count: 1 },
    days61to90: { totalCents: 30_000, count: 0 },
    days90plus: { totalCents: 20_000, count: 0 },
  },
};

describe("DashboardController", () => {
  let app: INestApplication;
  let summaryUseCase: { execute: jest.Mock };
  let needsAttentionUseCase: jest.Mocked<GetNeedsAttentionUseCase>;
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    summaryUseCase = { execute: jest.fn() };
    needsAttentionUseCase = { execute: jest.fn() } as never;
    businessAuth = {
      assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: GetDashboardSummaryUseCase, useValue: summaryUseCase },
        { provide: GetNeedsAttentionUseCase, useValue: needsAttentionUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
      ],
    }).compile();

    app = module.createNestApplication();
    // Stub Clerk auth — @AccountId() reads req.auth().userId
    app.use(
      (req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
        req.auth = () => ({ userId: USER_ID });
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/dashboard/summary", () => {
    it("returns 200 with summary envelope", async () => {
      summaryUseCase.execute.mockResolvedValue(SAMPLE_SUMMARY);

      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/summary")
        .query({ businessId: BIZ_ID });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: SAMPLE_SUMMARY });
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalledWith(USER_ID, BIZ_ID);
      expect(summaryUseCase.execute).toHaveBeenCalledWith(BIZ_ID);
    });

    it("returns 400 when businessId is missing", async () => {
      const res = await request(app.getHttpServer()).get("/v1/dashboard/summary");
      expect(res.status).toBe(400);
      expect(summaryUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 400 when businessId is not a UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/summary")
        .query({ businessId: "not-a-uuid" });
      expect(res.status).toBe(400);
      expect(summaryUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 401 when caller is not provisioned for the business", async () => {
      businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
        new CallerNotProvisionedError(USER_ID),
      );

      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/summary")
        .query({ businessId: BIZ_ID });

      expect(res.status).toBe(401);
      expect(summaryUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 404 when the business does not exist (auth check)", async () => {
      businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
        new BusinessNotFoundError(BIZ_ID),
      );

      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/summary")
        .query({ businessId: BIZ_ID });

      expect(res.status).toBe(404);
      expect(summaryUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 404 when the use case throws BusinessNotFoundError", async () => {
      summaryUseCase.execute.mockRejectedValueOnce(new BusinessNotFoundError(BIZ_ID));

      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/summary")
        .query({ businessId: BIZ_ID });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /v1/dashboard/needs-attention", () => {
    const SAMPLE_ITEMS = [
      {
        id: "msg-1",
        type: "client_replied" as const,
        invoiceId: "inv-1",
        invoiceNumber: "INV-001",
        customerId: "cust-1",
        customerName: "Acme",
        amountCents: 50_000,
        balanceDueCents: 25_000,
        daysOverdue: 14,
        occurredAt: "2026-05-20T10:00:00.000Z",
        summary: "Replied to a sequence message",
      },
    ];

    it("returns 200 with the items envelope (default limit 10)", async () => {
      needsAttentionUseCase.execute.mockResolvedValue(SAMPLE_ITEMS);

      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/needs-attention")
        .query({ businessId: BIZ_ID });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: SAMPLE_ITEMS });
      expect(needsAttentionUseCase.execute).toHaveBeenCalledWith(BIZ_ID, 10);
    });

    it("forwards an explicit limit to the use case", async () => {
      needsAttentionUseCase.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get("/v1/dashboard/needs-attention")
        .query({ businessId: BIZ_ID, limit: 25 });

      expect(needsAttentionUseCase.execute).toHaveBeenCalledWith(BIZ_ID, 25);
    });

    it("returns 400 when limit > 50", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/needs-attention")
        .query({ businessId: BIZ_ID, limit: 51 });
      expect(res.status).toBe(400);
      expect(needsAttentionUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 401 when caller does not own the business", async () => {
      businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
        new CallerNotProvisionedError(USER_ID),
      );
      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/needs-attention")
        .query({ businessId: BIZ_ID });
      expect(res.status).toBe(401);
      expect(needsAttentionUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns { data: [] } when nothing needs attention", async () => {
      needsAttentionUseCase.execute.mockResolvedValue([]);
      const res = await request(app.getHttpServer())
        .get("/v1/dashboard/needs-attention")
        .query({ businessId: BIZ_ID });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [] });
    });
  });
});
