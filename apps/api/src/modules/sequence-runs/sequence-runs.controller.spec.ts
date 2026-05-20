import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SequenceRunsController } from "./sequence-runs.controller";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { PauseSequenceRunUseCase } from "./application/pause-sequence-run.use-case";
import { ResumeSequenceRunUseCase } from "./application/resume-sequence-run.use-case";
import { StopSequenceRunUseCase } from "./application/stop-sequence-run.use-case";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "./domain/sequence-run.errors";
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
  let pauseUseCase: { execute: jest.Mock };
  let resumeUseCase: { execute: jest.Mock };
  let stopUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    pauseUseCase = { execute: jest.fn() };
    resumeUseCase = { execute: jest.fn() };
    stopUseCase = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [SequenceRunsController],
      providers: [
        { provide: ListSequenceRunsUseCase, useValue: listUseCase },
        { provide: GetSequenceRunUseCase, useValue: getUseCase },
        { provide: PauseSequenceRunUseCase, useValue: pauseUseCase },
        { provide: ResumeSequenceRunUseCase, useValue: resumeUseCase },
        { provide: StopSequenceRunUseCase, useValue: stopUseCase },
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

  describe("POST /v1/sequence-runs/:id/pause", () => {
    it("returns 200 with updated run on success", async () => {
      pauseUseCase.execute.mockResolvedValue({ ...detail, status: "paused", pausedReason: "manual_pause" });

      const res = await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_pause" })
        .expect(200);

      expect(res.body.data.status).toBe("paused");
      expect(pauseUseCase.execute).toHaveBeenCalledWith(RUN_ID, BIZ_ID);
    });

    it("returns 400 when body reason is wrong", async () => {
      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "something_else" })
        .expect(400);
    });

    it("returns 400 when InvalidStatusTransitionError", async () => {
      pauseUseCase.execute.mockRejectedValue(
        new InvalidStatusTransitionError(RUN_ID, "paused", "pause"),
      );

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_pause" })
        .expect(400);
    });

    it("returns 404 when SequenceRunNotFoundError", async () => {
      pauseUseCase.execute.mockRejectedValue(new SequenceRunNotFoundError(RUN_ID));

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_pause" })
        .expect(404);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/pause`)
        .send({ reason: "manual_pause" })
        .expect(400);
    });
  });

  describe("POST /v1/sequence-runs/:id/resume", () => {
    it("returns 200 with updated run on success", async () => {
      resumeUseCase.execute.mockResolvedValue({ ...detail, status: "active" });

      const res = await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/resume`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.status).toBe("active");
      expect(resumeUseCase.execute).toHaveBeenCalledWith(RUN_ID, BIZ_ID);
    });

    it("returns 400 when InvalidStatusTransitionError", async () => {
      resumeUseCase.execute.mockRejectedValue(
        new InvalidStatusTransitionError(RUN_ID, "active", "resume"),
      );

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/resume`)
        .query({ businessId: BIZ_ID })
        .expect(400);
    });

    it("returns 404 when SequenceRunNotFoundError", async () => {
      resumeUseCase.execute.mockRejectedValue(new SequenceRunNotFoundError(RUN_ID));

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/resume`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/resume`)
        .expect(400);
    });
  });

  describe("POST /v1/sequence-runs/:id/stop", () => {
    it("returns 200 with stopped run on success", async () => {
      stopUseCase.execute.mockResolvedValue({
        ...detail,
        status: "stopped",
        stoppedReason: "manual_stop",
      });

      const res = await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/stop`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_stop" })
        .expect(200);

      expect(res.body.data.status).toBe("stopped");
      expect(stopUseCase.execute).toHaveBeenCalledWith(RUN_ID, BIZ_ID);
    });

    it("returns 400 when body reason is wrong", async () => {
      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/stop`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manually_stopped" })
        .expect(400);
    });

    it("returns 400 when InvalidStatusTransitionError (completed run)", async () => {
      stopUseCase.execute.mockRejectedValue(
        new InvalidStatusTransitionError(RUN_ID, "completed", "stop"),
      );

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/stop`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_stop" })
        .expect(400);
    });

    it("returns 404 when SequenceRunNotFoundError", async () => {
      stopUseCase.execute.mockRejectedValue(new SequenceRunNotFoundError(RUN_ID));

      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/stop`)
        .query({ businessId: BIZ_ID })
        .send({ reason: "manual_stop" })
        .expect(404);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/sequence-runs/${RUN_ID}/stop`)
        .send({ reason: "manual_stop" })
        .expect(400);
    });
  });
});
