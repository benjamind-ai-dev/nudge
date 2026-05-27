import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DashboardController } from "./dashboard.controller";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
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
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    summaryUseCase = { execute: jest.fn() };
    businessAuth = {
      assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: GetDashboardSummaryUseCase, useValue: summaryUseCase },
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
});
