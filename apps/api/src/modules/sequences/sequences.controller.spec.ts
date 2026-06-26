import { Test } from "@nestjs/testing";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SequencesController } from "./sequences.controller";
import { ListSequencesUseCase } from "./application/list-sequences.use-case";
import { GetSequenceUseCase } from "./application/get-sequence.use-case";
import { CreateSequenceUseCase } from "./application/create-sequence.use-case";
import { UpdateSequenceUseCase } from "./application/update-sequence.use-case";
import { DeleteSequenceUseCase } from "./application/delete-sequence.use-case";
import { AddStepUseCase } from "./application/add-step.use-case";
import { UpdateStepUseCase } from "./application/update-step.use-case";
import { DeleteStepUseCase } from "./application/delete-step.use-case";
import { ReorderStepsUseCase } from "./application/reorder-steps.use-case";
import { ReplaceSequenceUseCase } from "./application/replace-sequence.use-case";
import { PreviewStepUseCase } from "./application/preview-step.use-case";
import { EnrollInvoicesUseCase } from "./application/enroll-invoices.use-case";
import { AttachCustomerUseCase } from "./application/attach-customer.use-case";
import { DetachCustomerUseCase } from "./application/detach-customer.use-case";
import { PauseSequenceUseCase } from "./application/pause-sequence.use-case";
import { ActivateSequenceUseCase } from "./application/activate-sequence.use-case";
import { SequenceNotFoundError } from "./domain/sequence.errors";
import type { SequenceSummary, SequenceWithSteps } from "./domain/sequence.entity";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { BusinessNotFoundError } from "../business/domain/business.errors";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const SEQ_ID = "550e8400-e29b-41d4-a716-446655440010";
const STEP_ID = "550e8400-e29b-41d4-a716-446655440020";
const FOREIGN_BIZ_ID = "550e8400-e29b-41d4-a716-446655440099";

const summary: SequenceSummary = {
  id: SEQ_ID,
  businessId: BIZ_ID,
  name: "Friendly Reminder",
  isActive: true,
  stepCount: 2,
  activeRuns: 0,
  inUse: false,
  inUseReason: null,
  relationshipTier: null,
  createdAt: new Date("2026-05-20T09:00:00Z"),
  updatedAt: new Date("2026-05-20T09:00:00Z"),
};

const sequenceWithSteps: SequenceWithSteps = {
  ...summary,
  steps: [
    {
      id: STEP_ID,
      templateId: null,
      stepOrder: 1,
      delayDays: 0,
      channel: "email",
      subjectTemplate: "Invoice reminder",
      bodyTemplate: "Please pay your invoice.",
      smsBodyTemplate: null,
      isOwnerAlert: false,
      includePaymentLink: true,
      createdAt: new Date("2026-05-20T09:00:00Z"),
      updatedAt: new Date("2026-05-20T09:00:00Z"),
    },
  ],
};

describe("SequencesController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let createUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let deleteUseCase: { execute: jest.Mock };
  let addStepUseCase: { execute: jest.Mock };
  let updateStepUseCase: { execute: jest.Mock };
  let deleteStepUseCase: { execute: jest.Mock };
  let reorderStepsUseCase: { execute: jest.Mock };
  let replaceUseCase: { execute: jest.Mock };
  let previewStepUseCase: { execute: jest.Mock };
  let enrollInvoices: { execute: jest.Mock };
  let attachCustomer: { execute: jest.Mock };
  let detachCustomer: { execute: jest.Mock };
  let pauseSequence: { execute: jest.Mock };
  let activateSequence: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    createUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    addStepUseCase = { execute: jest.fn() };
    updateStepUseCase = { execute: jest.fn() };
    deleteStepUseCase = { execute: jest.fn() };
    reorderStepsUseCase = { execute: jest.fn() };
    replaceUseCase = { execute: jest.fn() };
    previewStepUseCase = { execute: jest.fn() };
    enrollInvoices = { execute: jest.fn() };
    attachCustomer = { execute: jest.fn() };
    detachCustomer = { execute: jest.fn() };
    pauseSequence = { execute: jest.fn() };
    activateSequence = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [SequencesController],
      providers: [
        { provide: ListSequencesUseCase, useValue: listUseCase },
        { provide: GetSequenceUseCase, useValue: getUseCase },
        { provide: CreateSequenceUseCase, useValue: createUseCase },
        { provide: UpdateSequenceUseCase, useValue: updateUseCase },
        { provide: DeleteSequenceUseCase, useValue: deleteUseCase },
        { provide: AddStepUseCase, useValue: addStepUseCase },
        { provide: UpdateStepUseCase, useValue: updateStepUseCase },
        { provide: DeleteStepUseCase, useValue: deleteStepUseCase },
        { provide: ReorderStepsUseCase, useValue: reorderStepsUseCase },
        { provide: ReplaceSequenceUseCase, useValue: replaceUseCase },
        { provide: PreviewStepUseCase, useValue: previewStepUseCase },
        { provide: EnrollInvoicesUseCase, useValue: enrollInvoices },
        { provide: AttachCustomerUseCase, useValue: attachCustomer },
        { provide: DetachCustomerUseCase, useValue: detachCustomer },
        { provide: PauseSequenceUseCase, useValue: pauseSequence },
        { provide: ActivateSequenceUseCase, useValue: activateSequence },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
      ],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.use((req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
      req.auth = () => ({ userId: "test-account-id" });
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/sequences", () => {
    it("returns 200 with a list of sequences", async () => {
      listUseCase.execute.mockResolvedValue([summary]);

      const res = await request(app.getHttpServer())
        .get("/v1/sequences")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(SEQ_ID);
      expect(listUseCase.execute).toHaveBeenCalledWith(BIZ_ID);
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer()).get("/v1/sequences").expect(400);
    });

    it("returns 400 when businessId is not a UUID", async () => {
      await request(app.getHttpServer())
        .get("/v1/sequences")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });
  });

  describe("GET /v1/sequences/:id", () => {
    it("returns 200 with sequence detail", async () => {
      getUseCase.execute.mockResolvedValue(sequenceWithSteps);

      const res = await request(app.getHttpServer())
        .get(`/v1/sequences/${SEQ_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(SEQ_ID);
      expect(res.body.data.steps).toHaveLength(1);
    });

    it("returns 404 when SequenceNotFoundError", async () => {
      getUseCase.execute.mockRejectedValue(new SequenceNotFoundError(SEQ_ID));

      await request(app.getHttpServer())
        .get(`/v1/sequences/${SEQ_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });
  });

  describe("POST /v1/sequences/:id/enroll", () => {
    it("returns 200 with enrollment summary", async () => {
      enrollInvoices.execute.mockResolvedValue({ enrolled: 2, moved: 1, skipped: 0, items: [] });
      const res = await request(app.getHttpServer())
        .post("/v1/sequences/seq-1/enroll?businessId=11111111-1111-1111-1111-111111111111")
        .send({ invoiceIds: ["22222222-2222-2222-2222-222222222222"] })
        .expect(200);
      expect(res.body.data).toMatchObject({ enrolled: 2, moved: 1, skipped: 0 });
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalled();
    });
  });

  describe("POST /v1/sequences/:id/attach-customer", () => {
    it("returns 200", async () => {
      attachCustomer.execute.mockResolvedValue({ customerId: "c", overrideSet: true, enrollment: { enrolled: 1, moved: 0, skipped: 0, items: [] } });
      await request(app.getHttpServer())
        .post("/v1/sequences/seq-1/attach-customer?businessId=11111111-1111-1111-1111-111111111111")
        .send({ customerId: "33333333-3333-3333-3333-333333333333" })
        .expect(200);
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalled();
    });
  });

  describe("POST /v1/sequences/:id/detach-customer", () => {
    it("returns 200 with detach result", async () => {
      detachCustomer.execute.mockResolvedValue({ detached: true, stoppedRuns: 2 });
      const res = await request(app.getHttpServer())
        .post("/v1/sequences/seq-1/detach-customer?businessId=11111111-1111-1111-1111-111111111111")
        .send({ customerId: "33333333-3333-3333-3333-333333333333" })
        .expect(200);
      expect(res.body.data).toMatchObject({ detached: true, stoppedRuns: 2 });
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalled();
    });

    it("returns 200 with detached:false when override not found", async () => {
      detachCustomer.execute.mockResolvedValue({ detached: false, stoppedRuns: 0 });
      const res = await request(app.getHttpServer())
        .post("/v1/sequences/seq-1/detach-customer?businessId=11111111-1111-1111-1111-111111111111")
        .send({ customerId: "33333333-3333-3333-3333-333333333333" })
        .expect(200);
      expect(res.body.data).toMatchObject({ detached: false, stoppedRuns: 0 });
    });
  });

  describe("POST /v1/sequences/:id/pause", () => {
    it("returns 200 with updated summary", async () => {
      pauseSequence.execute.mockResolvedValue({ ...summary, isActive: false });

      const res = await request(app.getHttpServer())
        .post(`/v1/sequences/${SEQ_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.isActive).toBe(false);
      expect(pauseSequence.execute).toHaveBeenCalledWith(SEQ_ID, BIZ_ID);
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalled();
    });

    it("returns 404 when SequenceNotFoundError", async () => {
      pauseSequence.execute.mockRejectedValue(new SequenceNotFoundError(SEQ_ID));

      await request(app.getHttpServer())
        .post(`/v1/sequences/${SEQ_ID}/pause`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });
  });

  describe("POST /v1/sequences/:id/activate", () => {
    it("returns 200 with updated summary", async () => {
      activateSequence.execute.mockResolvedValue({ ...summary, isActive: true });

      const res = await request(app.getHttpServer())
        .post(`/v1/sequences/${SEQ_ID}/activate`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.isActive).toBe(true);
      expect(activateSequence.execute).toHaveBeenCalledWith(SEQ_ID, BIZ_ID);
      expect(businessAuth.assertCallerOwnsBusiness).toHaveBeenCalled();
    });

    it("returns 404 when SequenceNotFoundError", async () => {
      activateSequence.execute.mockRejectedValue(new SequenceNotFoundError(SEQ_ID));

      await request(app.getHttpServer())
        .post(`/v1/sequences/${SEQ_ID}/activate`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });
  });

  describe("cross-account authorization", () => {
    it("GET /v1/sequences returns 404 when businessId belongs to a different account", async () => {
      businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
        new BusinessNotFoundError(FOREIGN_BIZ_ID),
      );

      await request(app.getHttpServer())
        .get("/v1/sequences")
        .query({ businessId: FOREIGN_BIZ_ID })
        .expect(404);

      expect(listUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
