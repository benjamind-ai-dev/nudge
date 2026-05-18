import { GetMessageUseCase } from "./get-message.use-case";
import type { MessageRepository } from "../domain/message.repository";
import type { MessageDetail } from "../domain/message.entity";
import { MessageNotFoundError } from "../domain/message.errors";

const mkDetail = (over: Partial<MessageDetail> = {}): MessageDetail => ({
  id: "msg-1",
  channel: "email",
  recipientEmail: "client@example.com",
  recipientPhone: null,
  subject: "Reminder: Invoice INV-001",
  status: "sent",
  sentAt: new Date("2026-05-15T10:00:00Z"),
  openedAt: null,
  clickedAt: null,
  repliedAt: null,
  hasReply: false,
  customer: { id: "cust-1", companyName: "Acme Corp" },
  invoice: { id: "inv-1", invoiceNumber: "INV-001" },
  body: "<p>Hi there, this invoice is overdue.</p>",
  replyBody: null,
  aiDraftResponse: null,
  sequenceRun: { id: "run-1", status: "active" },
  sequenceStep: { stepOrder: 1, name: "Friendly reminder" },
  ...over,
});

const createMockRepo = (overrides: Partial<MessageRepository> = {}): MessageRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn().mockResolvedValue(null),
  findReplyContext: jest.fn().mockResolvedValue(null),
  createReplyMessage: jest.fn().mockResolvedValue(undefined),
  markMessageSent: jest.fn().mockResolvedValue(undefined),
  resumeRun: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("GetMessageUseCase", () => {
  it("returns the message when found", async () => {
    const detail = mkDetail();
    const repo = createMockRepo({ findDetailById: jest.fn().mockResolvedValue(detail) });
    const useCase = new GetMessageUseCase(repo);

    const result = await useCase.execute("msg-1", "biz-1");

    expect(result).toEqual(detail);
    expect(repo.findDetailById).toHaveBeenCalledWith("msg-1", "biz-1");
  });

  it("throws MessageNotFoundError when the repo returns null", async () => {
    const repo = createMockRepo({ findDetailById: jest.fn().mockResolvedValue(null) });
    const useCase = new GetMessageUseCase(repo);

    await expect(useCase.execute("missing", "biz-1")).rejects.toThrow(MessageNotFoundError);
  });

  it("returns the manual-reply shape (null sequenceStep) untouched", async () => {
    const detail = mkDetail({ sequenceStep: null });
    const repo = createMockRepo({ findDetailById: jest.fn().mockResolvedValue(detail) });
    const useCase = new GetMessageUseCase(repo);

    const result = await useCase.execute("msg-1", "biz-1");

    expect(result.sequenceStep).toBeNull();
  });
});
