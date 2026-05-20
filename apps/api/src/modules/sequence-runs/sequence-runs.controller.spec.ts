import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SequenceRunsController } from "./sequence-runs.controller";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { SequenceRunNotFoundError } from "./domain/sequence-run.errors";
import type {
  SequenceRunDetail,
  SequenceRunListItem,
} from "./domain/sequence-run.entity";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440001";

const listItem: SequenceRunListItem = {
  id: RUN_ID,
  status: "active",
  pausedReason: null,
  stoppedReason: null,
  nextSendAt: new Date("2026-05-21T13:00:00Z"),
  startedAt: new Date("2026-05-15T09:00:00Z"),
  completedAt: null,
  invoice: { id: "inv-1", invoiceNumber: "INV-001", amountCents: 10_000, balanceDueCents: 10_000 },
  customer: { id: "cust-1", companyName: "Acme" },
  currentStep: { stepOrder: 2, channel: "email" },
};

const detail: SequenceRunDetail = {
  id: RUN_ID,
  status: "active",
  pausedReason: null,
  stoppedReason: null,
  nextSendAt: new Date("2026-05-21T13:00:00Z"),
  startedAt: new Date("2026-05-15T09:00:00Z"),
  completedAt: null,
  invoice: {
    id: "inv-1",
    invoiceNumber: "INV-001",
    amountCents: 10_000,
    amountPaidCents: 0,
    balanceDueCents: 10_000,
    currency: "USD",
    dueDate: new Date("2026-05-01"),
    status: "overdue",
  },
  customer: {
    id: "cust-1",
    companyName: "Acme",
    contactName: null,
    contactEmail: "client@example.com",
    contactPhone: null,
  },
  sequence: { id: "seq-1", name: "Friendly default", tierName: "Default" },
  steps: [
    { id: "step-1", stepOrder: 1, delayDays: 0, channel: "email", state: "completed" },
    { id: "step-2", stepOrder: 2, delayDays: 3, channel: "email", state: "current" },
  ],
  messages: [
    {
      id: "msg-1",
      channel: "email",
      subject: "Reminder",
      status: "sent",
      sentAt: new Date("2026-05-15T09:00:00Z"),
      openedAt: null,
      clickedAt: null,
      repliedAt: null,
      replyBody: null,
    },
  ],
};

describe("SequenceRunsController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [SequenceRunsController],
      providers: [
        { provide: ListSequenceRunsUseCase, useValue: listUseCase },
        { provide: GetSequenceRunUseCase, useValue: getUseCase },
      ],
    }).compile();

    app = module.createNestApplication();
    // Attach a fake Clerk auth function so @AccountId() doesn't throw 401.
    app.use((req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
      req.auth = () => ({ userId: "test-account-id" });
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/sequence-runs", () => {
    it("returns 200 with paginated data", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [listItem],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get("/v1/sequence-runs")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(RUN_ID);
      expect(res.body.pagination).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .get("/v1/sequence-runs")
        .expect(400);
    });

    it("returns 400 when businessId is not a UUID", async () => {
      await request(app.getHttpServer())
        .get("/v1/sequence-runs")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });

    it("forwards filters to the use case", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });

      await request(app.getHttpServer())
        .get("/v1/sequence-runs")
        .query({
          businessId: BIZ_ID,
          status: "paused",
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          page: "2",
          limit: "10",
        })
        .expect(200);

      expect(listUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BIZ_ID,
          status: "paused",
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          page: 2,
          limit: 10,
        }),
      );
    });
  });

  describe("GET /v1/sequence-runs/:id", () => {
    it("returns 200 with full detail", async () => {
      getUseCase.execute.mockResolvedValue(detail);

      const res = await request(app.getHttpServer())
        .get(`/v1/sequence-runs/${RUN_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(RUN_ID);
      expect(res.body.data.steps).toHaveLength(2);
      expect(res.body.data.messages).toHaveLength(1);
    });

    it("returns 404 when the use case throws SequenceRunNotFoundError", async () => {
      getUseCase.execute.mockRejectedValue(new SequenceRunNotFoundError(RUN_ID));

      await request(app.getHttpServer())
        .get(`/v1/sequence-runs/${RUN_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .get(`/v1/sequence-runs/${RUN_ID}`)
        .expect(400);
    });
  });
});
