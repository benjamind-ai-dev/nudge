import { ListMessagesUseCase } from "./list-messages.use-case";
import type { MessageListFilter, MessageListResult, MessageRepository } from "../domain/message.repository";
import type { MessageListItem } from "../domain/message.entity";

const mkItem = (over: Partial<MessageListItem> = {}): MessageListItem => ({
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
  ...over,
});

const createMockRepo = (overrides: Partial<MessageRepository> = {}): MessageRepository => ({
  findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 0 } satisfies MessageListResult),
  findDetailById: jest.fn(),
  ...overrides,
});

describe("ListMessagesUseCase", () => {
  it("returns items and pagination metadata", async () => {
    const items = [mkItem(), mkItem({ id: "msg-2" })];
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items, total: 42 }),
    });
    const useCase = new ListMessagesUseCase(repo);

    const result = await useCase.execute({
      businessId: "biz-1",
      page: 1,
      limit: 25,
    });

    expect(result.data).toEqual(items);
    expect(result.pagination).toEqual({ page: 1, limit: 25, total: 42, totalPages: 2 });
  });

  it("forwards filters to the repository unchanged", async () => {
    const repo = createMockRepo();
    const useCase = new ListMessagesUseCase(repo);

    const filter: MessageListFilter = {
      businessId: "biz-1",
      page: 2,
      limit: 10,
      customerId: "cust-1",
      channel: "email",
      status: "sent",
      hasReply: true,
      sentAfter: new Date("2026-05-01T00:00:00Z"),
      sentBefore: new Date("2026-05-31T23:59:59Z"),
    };
    await useCase.execute(filter);

    expect(repo.findManyByFilter).toHaveBeenCalledWith(filter);
  });

  it("computes totalPages = 1 when total is zero", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    });
    const useCase = new ListMessagesUseCase(repo);

    const result = await useCase.execute({ businessId: "biz-1", page: 1, limit: 25 });

    expect(result.pagination.totalPages).toBe(1);
  });

  it("rounds totalPages up", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 26 }),
    });
    const useCase = new ListMessagesUseCase(repo);

    const result = await useCase.execute({ businessId: "biz-1", page: 1, limit: 25 });

    expect(result.pagination.totalPages).toBe(2);
  });
});
