import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MessagesController } from "./messages.controller";
import { ListMessagesUseCase } from "./application/list-messages.use-case";
import { GetMessageUseCase } from "./application/get-message.use-case";
import { SendReplyUseCase } from "./application/send-reply.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import {
  CustomerHasNoEmailError,
  MessageNotFoundError,
  NoReplyToRespondToError,
  OutboundEmailSendError,
} from "./domain/message.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import type { MessageDetail, MessageListItem } from "./domain/message.entity";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";
const MSG_ID = "550e8400-e29b-41d4-a716-446655440001";
const FOREIGN_BIZ_ID = "550e8400-e29b-41d4-a716-446655449999";

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
  let replyUseCase: { execute: jest.Mock };
  let businessAuth: { assertCallerOwnsBusiness: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    replyUseCase = { execute: jest.fn() };
    businessAuth = { assertCallerOwnsBusiness: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: ListMessagesUseCase, useValue: listUseCase },
        { provide: GetMessageUseCase, useValue: getUseCase },
        { provide: SendReplyUseCase, useValue: replyUseCase },
        { provide: BusinessAuthorizationService, useValue: businessAuth },
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

  describe("POST /v1/messages/:id/send-reply", () => {
    const validBody = { body: "Thanks for flagging this.", resumeSequence: true };

    it("returns 200 with the new message detail on success", async () => {
      replyUseCase.execute.mockResolvedValue(detail);

      const res = await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send(validBody)
        .expect(200);

      expect(res.body.data.id).toBe(MSG_ID);
      expect(replyUseCase.execute).toHaveBeenCalledWith(MSG_ID, BIZ_ID, validBody);
    });

    it("returns 404 when MessageNotFoundError is thrown", async () => {
      replyUseCase.execute.mockRejectedValue(new MessageNotFoundError(MSG_ID));

      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send(validBody)
        .expect(404);
    });

    it("returns 409 when NoReplyToRespondToError is thrown", async () => {
      replyUseCase.execute.mockRejectedValue(new NoReplyToRespondToError(MSG_ID));

      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send(validBody)
        .expect(409);
    });

    it("returns 422 when CustomerHasNoEmailError is thrown", async () => {
      replyUseCase.execute.mockRejectedValue(new CustomerHasNoEmailError("cust-1"));

      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send(validBody)
        .expect(422);
    });

    it("returns 502 when OutboundEmailSendError is thrown", async () => {
      replyUseCase.execute.mockRejectedValue(new OutboundEmailSendError(MSG_ID, new Error("Resend down")));

      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send(validBody)
        .expect(502);
    });

    it("returns 400 when the body is empty", async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send({ body: "   ", resumeSequence: false })
        .expect(400);
    });

    it("returns 400 when resumeSequence is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .query({ businessId: BIZ_ID })
        .send({ body: "hi" })
        .expect(400);
    });

    it("returns 400 when businessId query is missing", async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages/${MSG_ID}/send-reply`)
        .send(validBody)
        .expect(400);
    });
  });

  it("GET /v1/messages returns 404 when businessId belongs to a different account", async () => {
    businessAuth.assertCallerOwnsBusiness.mockRejectedValueOnce(
      new BusinessNotFoundError(FOREIGN_BIZ_ID),
    );

    await request(app.getHttpServer())
      .get(`/v1/messages?businessId=${FOREIGN_BIZ_ID}`)
      .expect(404);

    expect(listUseCase.execute).not.toHaveBeenCalled();
  });
});
