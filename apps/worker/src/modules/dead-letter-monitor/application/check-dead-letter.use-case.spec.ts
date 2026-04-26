import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { CheckDeadLetterUseCase } from "./check-dead-letter.use-case";
import { ALERT_SERVICE, type AlertService } from "../domain/alert.service";
import type { Job } from "bullmq";

const createMockQueue = () => ({
  getCompleted: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
});

describe("CheckDeadLetterUseCase", () => {
  let useCase: CheckDeadLetterUseCase;
  let deadLetterQueue: ReturnType<typeof createMockQueue>;
  let alertService: jest.Mocked<AlertService>;

  beforeEach(async () => {
    deadLetterQueue = createMockQueue();
    alertService = { send: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CheckDeadLetterUseCase,
        { provide: getQueueToken(QUEUE_NAMES.DEAD_LETTER), useValue: deadLetterQueue },
        { provide: getQueueToken(QUEUE_NAMES.MESSAGE_SEND), useValue: createMockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.TOKEN_REFRESH), useValue: createMockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.INVOICE_SYNC), useValue: createMockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.SEQUENCE_TRIGGER), useValue: createMockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.DAYS_RECALC), useValue: createMockQueue() },
        { provide: ALERT_SERVICE, useValue: alertService },
      ],
    }).compile();

    useCase = module.get(CheckDeadLetterUseCase);
  });

  it("returns clean result when no dead jobs found", async () => {
    deadLetterQueue.getCompleted.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.deadJobCount).toBe(0);
    expect(result.stuckJobCount).toBe(0);
    expect(result.alertSent).toBe(false);
    expect(alertService.send).not.toHaveBeenCalled();
  });

  it("sends alert when dead jobs are found", async () => {
    const now = new Date();
    const recentFailedAt = new Date(now.getTime() - 1000 * 60 * 60).toISOString(); // 1 hour ago

    deadLetterQueue.getCompleted.mockResolvedValue([
      {
        id: "job-1",
        data: {
          originalQueue: "message-send",
          originalJobId: "send-run-123",
          data: { businessId: "biz-1" },
          failedReason: "Resend API error",
          failedAt: recentFailedAt,
        },
      } as unknown as Job,
    ]);

    const result = await useCase.execute();

    expect(result.deadJobCount).toBe(1);
    expect(result.alertSent).toBe(true);
    expect(alertService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalCount: 1,
          severity: "critical",
          byQueue: { "message-send": 1 },
        }),
      }),
    );
  });

  it("calculates warning severity for non-critical queues", async () => {
    const recentFailedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    deadLetterQueue.getCompleted.mockResolvedValue([
      {
        id: "job-1",
        data: {
          originalQueue: "invoice-sync",
          originalJobId: "sync-123",
          data: { businessId: "biz-1" },
          failedReason: "Database error",
          failedAt: recentFailedAt,
        },
      } as unknown as Job,
    ]);

    const result = await useCase.execute();

    expect(result.deadJobCount).toBe(1);
    expect(alertService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          severity: "warning",
        }),
      }),
    );
  });

  it("ignores dead jobs older than 24 hours", async () => {
    const oldFailedAt = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(); // 25 hours ago

    deadLetterQueue.getCompleted.mockResolvedValue([
      {
        id: "job-1",
        data: {
          originalQueue: "message-send",
          originalJobId: "send-run-123",
          data: { businessId: "biz-1" },
          failedReason: "Old error",
          failedAt: oldFailedAt,
        },
      } as unknown as Job,
    ]);

    const result = await useCase.execute();

    expect(result.deadJobCount).toBe(0);
    expect(result.alertSent).toBe(false);
  });

  it("groups dead jobs by queue", async () => {
    const recentFailedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    deadLetterQueue.getCompleted.mockResolvedValue([
      {
        id: "job-1",
        data: {
          originalQueue: "message-send",
          originalJobId: "send-1",
          data: {},
          failedReason: "Error 1",
          failedAt: recentFailedAt,
        },
      },
      {
        id: "job-2",
        data: {
          originalQueue: "message-send",
          originalJobId: "send-2",
          data: {},
          failedReason: "Error 2",
          failedAt: recentFailedAt,
        },
      },
      {
        id: "job-3",
        data: {
          originalQueue: "token-refresh",
          originalJobId: "refresh-1",
          data: {},
          failedReason: "Error 3",
          failedAt: recentFailedAt,
        },
      },
    ] as unknown as Job[]);

    const result = await useCase.execute();

    expect(result.deadJobCount).toBe(3);
    expect(alertService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalCount: 3,
          byQueue: {
            "message-send": 2,
            "token-refresh": 1,
          },
        }),
      }),
    );
  });
});
