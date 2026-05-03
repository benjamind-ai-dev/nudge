import { ResendEventsProcessor } from "./resend-events.processor";
import type { HandleEmailDeliveredUseCase } from "./application/handle-email-delivered.use-case";
import type { HandleEmailOpenedUseCase } from "./application/handle-email-opened.use-case";
import type { HandleEmailClickedUseCase } from "./application/handle-email-clicked.use-case";
import type { HandleEmailBouncedUseCase } from "./application/handle-email-bounced.use-case";
import type { HandleEmailComplainedUseCase } from "./application/handle-email-complained.use-case";
import type { HandleEmailFailedUseCase } from "./application/handle-email-failed.use-case";
import type { HandleEmailReceivedUseCase } from "./application/handle-email-received.use-case";
import type { Job } from "bullmq";
import type { ResendEventsJobData } from "@nudge/shared";

function makeUseCases() {
  return {
    delivered: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailDeliveredUseCase,
    opened: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailOpenedUseCase,
    clicked: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailClickedUseCase,
    bounced: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailBouncedUseCase,
    complained: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailComplainedUseCase,
    failed: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailFailedUseCase,
    received: { execute: jest.fn().mockResolvedValue(undefined) } as unknown as HandleEmailReceivedUseCase,
  };
}

function makeJob(events: unknown[]): Job<ResendEventsJobData> {
  return { data: { payload: events } } as unknown as Job<ResendEventsJobData>;
}

describe("ResendEventsProcessor", () => {
  it("calls HandleEmailDeliveredUseCase for email.delivered", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }]));

    expect(uc.delivered.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc" });
  });

  it("calls HandleEmailOpenedUseCase for email.opened", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);
    const createdAt = "2024-01-01T12:00:00.000Z";

    await processor.process(makeJob([{ type: "email.opened", created_at: createdAt, data: { email_id: "re_abc" } }]));

    expect(uc.opened.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc", openedAt: new Date(createdAt) });
  });

  it("calls HandleEmailClickedUseCase for email.clicked", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);
    const createdAt = "2024-01-01T12:05:00.000Z";

    await processor.process(makeJob([{ type: "email.clicked", created_at: createdAt, data: { email_id: "re_abc" } }]));

    expect(uc.clicked.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc", clickedAt: new Date(createdAt) });
  });

  it("calls HandleEmailBouncedUseCase for email.bounced", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.bounced", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }]));

    expect(uc.bounced.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc" });
  });

  it("calls HandleEmailComplainedUseCase for email.complained", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.complained", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }]));

    expect(uc.complained.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc" });
  });

  it("calls HandleEmailFailedUseCase for email.failed", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.failed", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }]));

    expect(uc.failed.execute).toHaveBeenCalledWith({ externalMessageId: "re_abc" });
  });

  it("calls HandleEmailReceivedUseCase for email.received", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.received", created_at: "2024-01-01T00:00:00.000Z", data: { from: "customer@acme.com" } }]));

    expect(uc.received.execute).toHaveBeenCalledWith({ fromEmail: "customer@acme.com" });
  });

  it("parses display-name format from email.received", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([{ type: "email.received", created_at: "2024-01-01T00:00:00.000Z", data: { from: "John Smith <john@acme.com>" } }]));

    expect(uc.received.execute).toHaveBeenCalledWith({ fromEmail: "john@acme.com" });
  });

  it("skips events with unknown type without throwing", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await expect(processor.process(makeJob([{ type: "email.unknown_future_type", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_abc" } }]))).resolves.not.toThrow();

    expect(uc.delivered.execute).not.toHaveBeenCalled();
    expect(uc.bounced.execute).not.toHaveBeenCalled();
  });

  it("skips events with missing data.email_id without throwing", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await expect(processor.process(makeJob([{ type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: {} }]))).resolves.not.toThrow();

    expect(uc.delivered.execute).not.toHaveBeenCalled();
  });

  it("processes all events in a batch", async () => {
    const uc = makeUseCases();
    const processor = new ResendEventsProcessor(uc.delivered, uc.opened, uc.clicked, uc.bounced, uc.complained, uc.failed, uc.received);

    await processor.process(makeJob([
      { type: "email.delivered", created_at: "2024-01-01T00:00:00.000Z", data: { email_id: "re_1" } },
      { type: "email.opened", created_at: "2024-01-01T01:00:00.000Z", data: { email_id: "re_2" } },
    ]));

    expect(uc.delivered.execute).toHaveBeenCalledWith({ externalMessageId: "re_1" });
    expect(uc.opened.execute).toHaveBeenCalledWith({ externalMessageId: "re_2", openedAt: new Date("2024-01-01T01:00:00.000Z") });
  });
});
