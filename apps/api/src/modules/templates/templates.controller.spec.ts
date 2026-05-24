import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TemplatesController } from "./templates.controller";
import { ListTemplatesUseCase } from "./application/list-templates.use-case";
import { GetTemplateUseCase } from "./application/get-template.use-case";
import { CreateTemplateUseCase } from "./application/create-template.use-case";
import { UpdateTemplateUseCase } from "./application/update-template.use-case";
import { DeleteTemplateUseCase } from "./application/delete-template.use-case";
import { GenerateTemplateUseCase } from "./application/generate-template.use-case";
import { AttachTemplateToCustomerUseCase } from "./application/attach-template-to-customer.use-case";
import { DetachTemplateFromCustomerUseCase } from "./application/detach-template-from-customer.use-case";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import type { Template } from "./domain/template.entity";
import type { AiTemplateDraft } from "./application/ports/ai-template.client";
import type { CallerContext } from "../../common/auth-context/caller-context.types";

const CLERK_USER = "user_test_clerk";
const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEMPLATE_ID = "550e8400-e29b-41d4-a716-446655440010";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440020";

const callerCtxFixture: CallerContext = {
  userId: "550e8400-e29b-41d4-a716-446655440001",
  accountId: BIZ_ID,
  role: "owner",
};

const templateFixture: Template = {
  id: TEMPLATE_ID,
  businessId: BIZ_ID,
  name: "Payment Reminder",
  subject: "Your invoice is due",
  body: "Hi {{customer.contact_name}}, your invoice is due.",
  signature: "The Team",
  createdAt: new Date("2026-05-20T09:00:00Z"),
  updatedAt: new Date("2026-05-20T09:00:00Z"),
};

const aiDraftFixture: AiTemplateDraft = {
  name: "Gentle Reminder",
  subject: "Friendly invoice reminder",
  body: "Hi {{customer.contact_name}}, just a reminder about your invoice.",
  signature: "{{business.sender_name}}",
};

describe("TemplatesController", () => {
  let app: INestApplication;
  let listUc: { execute: jest.Mock };
  let getUc: { execute: jest.Mock };
  let createUc: { execute: jest.Mock };
  let updateUc: { execute: jest.Mock };
  let deleteUc: { execute: jest.Mock };
  let generateUc: { execute: jest.Mock };
  let attachUc: { execute: jest.Mock };
  let detachUc: { execute: jest.Mock };
  let callerCtx: { resolve: jest.Mock };

  beforeEach(async () => {
    listUc = { execute: jest.fn() };
    getUc = { execute: jest.fn() };
    createUc = { execute: jest.fn() };
    updateUc = { execute: jest.fn() };
    deleteUc = { execute: jest.fn() };
    generateUc = { execute: jest.fn() };
    attachUc = { execute: jest.fn() };
    detachUc = { execute: jest.fn() };
    callerCtx = { resolve: jest.fn().mockResolvedValue(callerCtxFixture) };

    const module = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: ListTemplatesUseCase, useValue: listUc },
        { provide: GetTemplateUseCase, useValue: getUc },
        { provide: CreateTemplateUseCase, useValue: createUc },
        { provide: UpdateTemplateUseCase, useValue: updateUc },
        { provide: DeleteTemplateUseCase, useValue: deleteUc },
        { provide: GenerateTemplateUseCase, useValue: generateUc },
        { provide: AttachTemplateToCustomerUseCase, useValue: attachUc },
        { provide: DetachTemplateFromCustomerUseCase, useValue: detachUc },
        { provide: CallerContextService, useValue: callerCtx },
      ],
    }).compile();

    app = module.createNestApplication();
    // Simulate Clerk middleware: @AccountId() calls req.auth().userId
    app.use(
      (req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
        req.auth = () => ({ userId: CLERK_USER });
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/templates", () => {
    it("returns 200 with the list of templates", async () => {
      listUc.execute.mockResolvedValue([templateFixture]);

      const res = await request(app.getHttpServer()).get("/v1/templates").expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(TEMPLATE_ID);
      expect(listUc.execute).toHaveBeenCalledWith({ businessId: BIZ_ID });
    });

    it("returns 401 when caller context cannot be resolved", async () => {
      callerCtx.resolve.mockResolvedValue(null);

      await request(app.getHttpServer()).get("/v1/templates").expect(401);
      expect(listUc.execute).not.toHaveBeenCalled();
    });
  });

  describe("GET /v1/templates/:id", () => {
    it("returns 200 with the template when found", async () => {
      getUc.execute.mockResolvedValue(templateFixture);

      const res = await request(app.getHttpServer())
        .get(`/v1/templates/${TEMPLATE_ID}`)
        .expect(200);

      expect(res.body.data.id).toBe(TEMPLATE_ID);
      expect(getUc.execute).toHaveBeenCalledWith({ id: TEMPLATE_ID, businessId: BIZ_ID });
    });

    it("returns 404 when template is not found", async () => {
      const { NotFoundException } = await import("@nestjs/common");
      getUc.execute.mockRejectedValue(new NotFoundException(`Template ${TEMPLATE_ID} not found`));

      await request(app.getHttpServer())
        .get(`/v1/templates/${TEMPLATE_ID}`)
        .expect(404);
    });
  });

  describe("POST /v1/templates", () => {
    const validBody = {
      name: "Payment Reminder",
      subject: "Your invoice is due",
      body: "Hi {{customer.contact_name}}, your invoice is due.",
      signature: "The Team",
    };

    it("returns 201 on create", async () => {
      createUc.execute.mockResolvedValue(templateFixture);

      const res = await request(app.getHttpServer())
        .post("/v1/templates")
        .send(validBody)
        .expect(201);

      expect(res.body.data.id).toBe(TEMPLATE_ID);
      expect(createUc.execute).toHaveBeenCalledWith({
        businessId: BIZ_ID,
        name: validBody.name,
        subject: validBody.subject,
        body: validBody.body,
        signature: validBody.signature,
      });
    });

    it("returns 400 when body is missing required fields", async () => {
      await request(app.getHttpServer())
        .post("/v1/templates")
        .send({})
        .expect(400);

      expect(createUc.execute).not.toHaveBeenCalled();
    });

    it("returns 400 when body field is empty string", async () => {
      await request(app.getHttpServer())
        .post("/v1/templates")
        .send({ name: "Test", body: "" })
        .expect(400);

      expect(createUc.execute).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /v1/templates/:id", () => {
    it("returns 200 with the updated template", async () => {
      const updated = { ...templateFixture, name: "Updated Name" };
      updateUc.execute.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/v1/templates/${TEMPLATE_ID}`)
        .send({ name: "Updated Name" })
        .expect(200);

      expect(res.body.data.name).toBe("Updated Name");
      expect(updateUc.execute).toHaveBeenCalledWith({
        id: TEMPLATE_ID,
        businessId: BIZ_ID,
        patch: { name: "Updated Name" },
      });
    });
  });

  describe("DELETE /v1/templates/:id", () => {
    it("returns 204 on delete", async () => {
      deleteUc.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/v1/templates/${TEMPLATE_ID}`)
        .expect(204);

      expect(deleteUc.execute).toHaveBeenCalledWith({ id: TEMPLATE_ID, businessId: BIZ_ID });
    });
  });

  describe("POST /v1/templates/generate", () => {
    it("returns 200 with the AI draft (not persisted)", async () => {
      generateUc.execute.mockResolvedValue(aiDraftFixture);

      const res = await request(app.getHttpServer())
        .post("/v1/templates/generate")
        .send({ description: "A gentle payment reminder for overdue invoices" })
        .expect(200);

      expect(res.body.data).toEqual(expect.objectContaining({
        name: aiDraftFixture.name,
        subject: aiDraftFixture.subject,
        body: aiDraftFixture.body,
      }));
      expect(generateUc.execute).toHaveBeenCalledWith({
        description: "A gentle payment reminder for overdue invoices",
      });
    });

    it("returns 400 when description is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/templates/generate")
        .send({})
        .expect(400);

      expect(generateUc.execute).not.toHaveBeenCalled();
    });
  });

  describe("POST /v1/customers/:customerId/templates", () => {
    it("attaches template to customer and returns 201", async () => {
      attachUc.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/v1/customers/${CUSTOMER_ID}/templates`)
        .send({ templateId: TEMPLATE_ID })
        .expect(201);

      expect(attachUc.execute).toHaveBeenCalledWith({
        templateId: TEMPLATE_ID,
        customerId: CUSTOMER_ID,
        businessId: BIZ_ID,
      });
    });

    it("returns 400 when templateId is not a UUID", async () => {
      await request(app.getHttpServer())
        .post(`/v1/customers/${CUSTOMER_ID}/templates`)
        .send({ templateId: "not-a-uuid" })
        .expect(400);

      expect(attachUc.execute).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /v1/customers/:customerId/templates/:templateId", () => {
    it("detaches template from customer and returns 204", async () => {
      detachUc.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/v1/customers/${CUSTOMER_ID}/templates/${TEMPLATE_ID}`)
        .expect(204);

      expect(detachUc.execute).toHaveBeenCalledWith({
        templateId: TEMPLATE_ID,
        customerId: CUSTOMER_ID,
        businessId: BIZ_ID,
      });
    });
  });
});
