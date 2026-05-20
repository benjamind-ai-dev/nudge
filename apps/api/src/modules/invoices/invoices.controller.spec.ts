import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { InvoicesController } from "./invoices.controller";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { GetInvoiceUseCase } from "./application/get-invoice.use-case";
import { CreatePaymentLinkUseCase } from "./application/create-payment-link.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import {
  InvalidStateForPaymentLinkError,
  InvoiceNotFoundError,
} from "./domain/invoice.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import type {
  InvoiceDetail,
  InvoiceListItem,
} from "./domain/invoice.entity";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const INV_ID = "550e8400-e29b-41d4-a716-446655440001";
const FOREIGN_BIZ_ID = "550e8400-e29b-41d4-a716-446655449999";

const listItem: InvoiceListItem = {
  id: INV_ID,
  invoiceNumber: "INV-001",
  status: "overdue",
  amountCents: 10_000,
  amountPaidCents: 0,
  balanceDueCents: 10_000,
  currency: "USD",
  daysOverdue: 5,
  dueDate: new Date("2026-05-01"),
  issuedDate: new Date("2026-04-15"),
  paymentLinkUrl: null,
  createdAt: new Date("2026-04-15T09:00:00Z"),
  updatedAt: new Date("2026-05-06T09:00:00Z"),
  customer: { id: "cust-1", companyName: "Acme Corp" },
  sequenceRun: null,
};

const detail: InvoiceDetail = {
  id: INV_ID,
  invoiceNumber: "INV-001",
  status: "overdue",
  amountCents: 10_000,
  amountPaidCents: 0,
  balanceDueCents: 10_000,
  currency: "USD",
  daysOverdue: 5,
  dueDate: new Date("2026-05-01"),
  issuedDate: new Date("2026-04-15"),
  paymentLinkUrl: null,
  createdAt: new Date("2026-04-15T09:00:00Z"),
  updatedAt: new Date("2026-05-06T09:00:00Z"),
  paidAt: null,
  aiPaymentScore: null,
  aiScoreReason: null,
  customer: {
    id: "cust-1",
    companyName: "Acme Corp",
    contactName: "Jane",
    contactEmail: "jane@acme.example",
    contactPhone: null,
    paymentTerms: "net30",
  },
  sequenceRun: null,
  messages: [],
};

describe("InvoicesController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let payLinkUseCase: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    payLinkUseCase = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: ListInvoicesUseCase, useValue: listUseCase },
        { provide: GetInvoiceUseCase, useValue: getUseCase },
        { provide: CreatePaymentLinkUseCase, useValue: payLinkUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
      ],
    }).compile();

    app = module.createNestApplication();
    // Stub Clerk auth — @AccountId() reads req.auth().userId
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

  describe("GET /v1/invoices", () => {
    it("returns 200 with paginated data", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [listItem],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get("/v1/invoices")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(INV_ID);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer()).get("/v1/invoices").expect(400);
    });

    it("returns 400 when businessId is not a UUID", async () => {
      await request(app.getHttpServer())
        .get("/v1/invoices")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });

    it("returns 400 when minAmount > maxAmount", async () => {
      await request(app.getHttpServer())
        .get("/v1/invoices")
        .query({ businessId: BIZ_ID, minAmount: "5000", maxAmount: "1000" })
        .expect(400);
    });

    it("forwards filters and sort to the use case", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });

      await request(app.getHttpServer())
        .get("/v1/invoices")
        .query({
          businessId: BIZ_ID,
          status: "overdue",
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          minAmount: "1000",
          maxAmount: "100000",
          dueAfter: "2026-04-01",
          dueBefore: "2026-06-01",
          sortBy: "days_overdue",
          sortOrder: "asc",
          page: "2",
          limit: "10",
        })
        .expect(200);

      expect(listUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BIZ_ID,
          status: "overdue",
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          minAmount: 1000,
          maxAmount: 100_000,
          sortBy: "days_overdue",
          sortOrder: "asc",
          page: 2,
          limit: 10,
        }),
      );
    });

    it("accepts disputed as a status filter", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });
      await request(app.getHttpServer())
        .get("/v1/invoices")
        .query({ businessId: BIZ_ID, status: "disputed" })
        .expect(200);
    });
  });

  describe("GET /v1/invoices/:id", () => {
    it("returns 200 with full detail", async () => {
      getUseCase.execute.mockResolvedValue(detail);

      const res = await request(app.getHttpServer())
        .get(`/v1/invoices/${INV_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(INV_ID);
      expect(res.body.data.customer.companyName).toBe("Acme Corp");
    });

    it("returns 404 when InvoiceNotFoundError", async () => {
      getUseCase.execute.mockRejectedValue(new InvoiceNotFoundError(INV_ID));
      await request(app.getHttpServer())
        .get(`/v1/invoices/${INV_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId missing", async () => {
      await request(app.getHttpServer())
        .get(`/v1/invoices/${INV_ID}`)
        .expect(400);
    });
  });

  describe("POST /v1/invoices/:id/payment-link", () => {
    it("returns 200 with payment link URL", async () => {
      payLinkUseCase.execute.mockResolvedValue({
        paymentLinkUrl: "https://buy.stripe.com/test_abc",
      });

      const res = await request(app.getHttpServer())
        .post(`/v1/invoices/${INV_ID}/payment-link`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.paymentLinkUrl).toBe(
        "https://buy.stripe.com/test_abc",
      );
      expect(payLinkUseCase.execute).toHaveBeenCalledWith(INV_ID, BIZ_ID);
    });

    it("returns 404 when InvoiceNotFoundError", async () => {
      payLinkUseCase.execute.mockRejectedValue(
        new InvoiceNotFoundError(INV_ID),
      );
      await request(app.getHttpServer())
        .post(`/v1/invoices/${INV_ID}/payment-link`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when InvalidStateForPaymentLinkError", async () => {
      payLinkUseCase.execute.mockRejectedValue(
        new InvalidStateForPaymentLinkError(INV_ID, "paid"),
      );
      await request(app.getHttpServer())
        .post(`/v1/invoices/${INV_ID}/payment-link`)
        .query({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/invoices/${INV_ID}/payment-link`)
        .expect(400);
    });
  });

  it("GET /v1/invoices/:id returns 404 when businessId belongs to a different account", async () => {
    businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
      new BusinessNotFoundError(FOREIGN_BIZ_ID),
    );

    await request(app.getHttpServer())
      .get(`/v1/invoices/${INV_ID}?businessId=${FOREIGN_BIZ_ID}`)
      .expect(404);

    expect(getUseCase.execute).not.toHaveBeenCalled();
  });
});
