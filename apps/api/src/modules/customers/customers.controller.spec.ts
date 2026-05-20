import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { CustomersController } from "./customers.controller";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { GetCustomerUseCase } from "./application/get-customer.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { AssignCustomerTierUseCase } from "./application/assign-customer-tier.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import {
  CustomerNotFoundError,
  SequenceBelongsToDifferentBusinessError,
  TierBelongsToDifferentBusinessError,
} from "./domain/customer.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import type { Customer, CustomerDetail } from "./domain/customer.entity";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUST_ID = "550e8400-e29b-41d4-a716-446655440001";
const FOREIGN_BIZ_ID = "550e8400-e29b-41d4-a716-446655449999";
const TIER_ID = "550e8400-e29b-41d4-a716-446655440002";
const SEQ_ID = "550e8400-e29b-41d4-a716-446655440003";

const customer: Customer = {
  id: CUST_ID,
  businessId: BIZ_ID,
  companyName: "Acme Corp",
  contactName: "Jane",
  contactEmail: "jane@acme.example",
  contactPhone: null,
  relationshipTier: { id: TIER_ID, name: "Gold" },
  sequenceId: null,
  paymentTerms: "net30",
  avgDaysToPay: 14.5,
  totalOutstanding: 25_000,
  isActive: true,
  createdAt: new Date("2026-01-01T09:00:00Z"),
  updatedAt: new Date("2026-05-01T09:00:00Z"),
};

const detail: CustomerDetail = {
  ...customer,
  recentInvoices: [
    {
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "overdue",
      amountCents: 10_000,
      balanceDueCents: 10_000,
      dueDate: new Date("2026-05-01"),
      daysOverdue: 5,
    },
  ],
  activeSequenceRunCount: 2,
  lastMessageSentAt: new Date("2026-05-06T09:00:00Z"),
};

describe("CustomersController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let assignTierUseCase: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    assignTierUseCase = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: ListCustomersUseCase, useValue: listUseCase },
        { provide: GetCustomerUseCase, useValue: getUseCase },
        { provide: UpdateCustomerUseCase, useValue: updateUseCase },
        { provide: AssignCustomerTierUseCase, useValue: assignTierUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
        req.auth = () => ({ userId: "test-account-id" });
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/customers", () => {
    it("returns 200 with paginated data", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [customer],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get("/v1/customers")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(CUST_ID);
      expect(res.body.data[0].relationshipTier).toEqual({ id: TIER_ID, name: "Gold" });
      expect(res.body.pagination).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer()).get("/v1/customers").expect(400);
    });

    it("returns 400 when businessId is not a UUID", async () => {
      await request(app.getHttpServer())
        .get("/v1/customers")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });

    it("returns 400 when limit > 100", async () => {
      await request(app.getHttpServer())
        .get("/v1/customers")
        .query({ businessId: BIZ_ID, limit: "101" })
        .expect(400);
    });

    it("returns 400 on invalid sortBy", async () => {
      await request(app.getHttpServer())
        .get("/v1/customers")
        .query({ businessId: BIZ_ID, sortBy: "bogus" })
        .expect(400);
    });

    it("forwards search, tier, hasOverdue, includeInactive, sort to the use case", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });

      await request(app.getHttpServer())
        .get("/v1/customers")
        .query({
          businessId: BIZ_ID,
          search: "acme",
          tierId: TIER_ID,
          hasOverdue: "true",
          includeInactive: "true",
          sortBy: "total_outstanding",
          sortOrder: "desc",
          page: "2",
          limit: "10",
        })
        .expect(200);

      expect(listUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BIZ_ID,
          search: "acme",
          tierId: TIER_ID,
          hasOverdue: true,
          includeInactive: true,
          sortBy: "total_outstanding",
          sortOrder: "desc",
          page: 2,
          limit: 10,
        }),
      );
    });

    it("defaults includeInactive to false and sortBy to company_name asc", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });

      await request(app.getHttpServer())
        .get("/v1/customers")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(listUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          includeInactive: false,
          sortBy: "company_name",
          sortOrder: "asc",
        }),
      );
    });
  });

  describe("GET /v1/customers/:id", () => {
    it("returns 200 with full detail", async () => {
      getUseCase.execute.mockResolvedValue(detail);

      const res = await request(app.getHttpServer())
        .get(`/v1/customers/${CUST_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(CUST_ID);
      expect(res.body.data.recentInvoices).toHaveLength(1);
      expect(res.body.data.activeSequenceRunCount).toBe(2);
      expect(res.body.data.lastMessageSentAt).toBeDefined();
    });

    it("returns 404 when CustomerNotFoundError", async () => {
      getUseCase.execute.mockRejectedValue(new CustomerNotFoundError(CUST_ID));
      await request(app.getHttpServer())
        .get(`/v1/customers/${CUST_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId missing", async () => {
      await request(app.getHttpServer())
        .get(`/v1/customers/${CUST_ID}`)
        .expect(400);
    });
  });

  describe("PATCH /v1/customers/:id", () => {
    it("returns 200 with updated customer", async () => {
      updateUseCase.execute.mockResolvedValue(customer);

      const res = await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}`)
        .send({ businessId: BIZ_ID, relationshipTierId: TIER_ID, sequenceId: SEQ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(CUST_ID);
      expect(updateUseCase.execute).toHaveBeenCalledWith(CUST_ID, BIZ_ID, {
        relationshipTierId: TIER_ID,
        sequenceId: SEQ_ID,
      });
    });

    it("returns 404 when CustomerNotFoundError", async () => {
      updateUseCase.execute.mockRejectedValue(new CustomerNotFoundError(CUST_ID));
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}`)
        .send({ businessId: BIZ_ID, relationshipTierId: TIER_ID })
        .expect(404);
    });

    it("returns 400 when TierBelongsToDifferentBusinessError", async () => {
      updateUseCase.execute.mockRejectedValue(
        new TierBelongsToDifferentBusinessError(TIER_ID, BIZ_ID),
      );
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}`)
        .send({ businessId: BIZ_ID, relationshipTierId: TIER_ID })
        .expect(400);
    });

    it("returns 400 when SequenceBelongsToDifferentBusinessError", async () => {
      updateUseCase.execute.mockRejectedValue(
        new SequenceBelongsToDifferentBusinessError(SEQ_ID, BIZ_ID),
      );
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}`)
        .send({ businessId: BIZ_ID, sequenceId: SEQ_ID })
        .expect(400);
    });

    it("returns 400 when relationshipTierId is not a UUID", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}`)
        .send({ businessId: BIZ_ID, relationshipTierId: "not-a-uuid" })
        .expect(400);
    });
  });

  describe("PATCH /v1/customers/:id/tier", () => {
    it("returns 200 when assigning a tier", async () => {
      assignTierUseCase.execute.mockResolvedValue(customer);

      const res = await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID, tierId: TIER_ID })
        .expect(200);

      expect(res.body.data.id).toBe(CUST_ID);
      expect(assignTierUseCase.execute).toHaveBeenCalledWith(CUST_ID, BIZ_ID, TIER_ID);
    });

    it("returns 200 when clearing the tier with null", async () => {
      assignTierUseCase.execute.mockResolvedValue({ ...customer, relationshipTier: null });

      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID, tierId: null })
        .expect(200);

      expect(assignTierUseCase.execute).toHaveBeenCalledWith(CUST_ID, BIZ_ID, null);
    });

    it("returns 400 when TierBelongsToDifferentBusinessError", async () => {
      assignTierUseCase.execute.mockRejectedValue(
        new TierBelongsToDifferentBusinessError(TIER_ID, BIZ_ID),
      );
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID, tierId: TIER_ID })
        .expect(400);
    });

    it("returns 404 when CustomerNotFoundError", async () => {
      assignTierUseCase.execute.mockRejectedValue(new CustomerNotFoundError(CUST_ID));
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID, tierId: TIER_ID })
        .expect(404);
    });

    it("returns 400 when tierId is omitted", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 400 when tierId is not a UUID", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/customers/${CUST_ID}/tier`)
        .send({ businessId: BIZ_ID, tierId: "not-a-uuid" })
        .expect(400);
    });
  });

  it("GET /v1/customers returns 404 when businessId belongs to a different account", async () => {
    businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
      new BusinessNotFoundError(FOREIGN_BIZ_ID),
    );

    await request(app.getHttpServer())
      .get(`/v1/customers?businessId=${FOREIGN_BIZ_ID}`)
      .expect(404);

    expect(listUseCase.execute).not.toHaveBeenCalled();
  });
});
