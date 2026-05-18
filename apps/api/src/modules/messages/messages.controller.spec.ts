import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MessagesController } from "./messages.controller";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { MessageNotFoundError } from "./domain/message.errors";
import type { MessageDetail, MessageListItem } from "./domain/message.entity";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const MSG_ID = "550e8400-e29b-41d4-a716-446655440001";

const listItem: MessageListItem = {
  id: MSG_ID,
  channel: "email",
  recipientEmail: "client@example.com",
  recipientPhone: null,
  subject: "Reminder",
  status: "sent",
  sentAt: new Date("2026-05-15T10:00:00Z"),
  openedAt: null,
  clickedAt: null,
  repliedAt: null,
  hasReply: false,
  customer: { id: "cust-1", companyName: "Acme" },
  invoice: { id: "inv-1", invoiceNumber: "INV-001" },
};

const detail: MessageDetail = {
  ...listItem,
  body: "<p>Hello</p>",
  replyBody: null,
  aiDraftResponse: null,
  sequenceRun: { id: "run-1", status: "active" },
  sequenceStep: { stepOrder: 1, name: "Friendly reminder" },
};

describe("MessagesController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: ListMessagesUseCase, useValue: listUseCase },
        { provide: GetMessageUseCase, useValue: getUseCase },
      ],
    }).compile();

    app = module.createNestApplication();
    // Attach a fake Clerk auth function so @AccountId() doesn't throw 401
    app.use((req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
      req.auth = () => ({ userId: "test-account-id" });
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/messages", () => {
    it("returns 200 with paginated data", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [listItem],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get("/v1/messages")
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(MSG_ID);
      expect(res.body.pagination).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    });

    it("returns 400 when businessId is missing", async () => {
      await request(app.getHttpServer()).get("/v1/messages").expect(400);
    });

    it("returns 400 when businessId is not a uuid", async () => {
      await request(app.getHttpServer())
        .get("/v1/messages")
        .query({ businessId: "not-a-uuid" })
        .expect(400);
    });

    it("forwards filters to the use case", async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      });

      await request(app.getHttpServer())
        .get("/v1/messages")
        .query({
          businessId: BIZ_ID,
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          channel: "email",
          status: "sent",
          hasReply: "true",
          page: "2",
          limit: "10",
        })
        .expect(200);

      expect(listUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BIZ_ID,
          customerId: "550e8400-e29b-41d4-a716-446655440099",
          channel: "email",
          status: "sent",
          hasReply: true,
          page: 2,
          limit: 10,
        }),
      );
    });
  });

  describe("GET /v1/messages/:id", () => {
    it("returns 200 with full detail", async () => {
      getUseCase.execute.mockResolvedValue(detail);

      const res = await request(app.getHttpServer())
        .get(`/v1/messages/${MSG_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(200);

      expect(res.body.data.id).toBe(MSG_ID);
      expect(res.body.data.body).toBe("<p>Hello</p>");
      expect(res.body.data.sequenceStep).toEqual({ stepOrder: 1, name: "Friendly reminder" });
    });

    it("returns 404 when use case throws MessageNotFoundError", async () => {
      getUseCase.execute.mockRejectedValue(new MessageNotFoundError(MSG_ID));

      await request(app.getHttpServer())
        .get(`/v1/messages/${MSG_ID}`)
        .query({ businessId: BIZ_ID })
        .expect(404);
    });

    it("returns 400 when businessId query param is missing", async () => {
      await request(app.getHttpServer()).get(`/v1/messages/${MSG_ID}`).expect(400);
    });
  });
});
