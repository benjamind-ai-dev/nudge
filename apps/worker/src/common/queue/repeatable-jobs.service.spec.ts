import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { RepeatableJobsService } from "./repeatable-jobs.service";

describe("RepeatableJobsService", () => {
  let service: RepeatableJobsService;

  const mockInvoiceSyncQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const mockSequenceTriggerQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const mockMessageSendQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const mockTokenRefreshQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
  const mockDaysRecalcQueue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RepeatableJobsService,
        { provide: getQueueToken(QUEUE_NAMES.INVOICE_SYNC), useValue: mockInvoiceSyncQueue },
        { provide: getQueueToken(QUEUE_NAMES.SEQUENCE_TRIGGER), useValue: mockSequenceTriggerQueue },
        { provide: getQueueToken(QUEUE_NAMES.MESSAGE_SEND), useValue: mockMessageSendQueue },
        { provide: getQueueToken(QUEUE_NAMES.TOKEN_REFRESH), useValue: mockTokenRefreshQueue },
        { provide: getQueueToken(QUEUE_NAMES.DAYS_RECALC), useValue: mockDaysRecalcQueue },
      ],
    }).compile();

    service = module.get(RepeatableJobsService);
  });

  afterEach(() => jest.clearAllMocks());

  it("should register invoice-sync every 15 minutes", async () => {
    await service.onModuleInit();

    expect(mockInvoiceSyncQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "invoice-sync-scheduler",
      { every: 900_000 },
      { name: "invoice-sync-tick" },
    );
  });

  it("should register sequence-trigger every 5 minutes", async () => {
    await service.onModuleInit();

    expect(mockSequenceTriggerQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "sequence-trigger-scheduler",
      { every: 300_000 },
      { name: "sequence-trigger-tick" },
    );
  });

  it("should register message-send every 1 minute", async () => {
    await service.onModuleInit();

    expect(mockMessageSendQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "message-send-scheduler",
      { every: 60_000 },
      { name: "message-send-tick" },
    );
  });

  it("should register token-refresh every 10 minutes", async () => {
    await service.onModuleInit();

    expect(mockTokenRefreshQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "token-refresh-scheduler",
      { every: 600_000 },
      { name: "token-refresh-tick" },
    );
  });

  it("should register days-recalc daily at midnight UTC with attempts and backoff", async () => {
    await service.onModuleInit();

    expect(mockDaysRecalcQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "days-recalc-scheduler",
      { pattern: "0 0 * * *" },
      {
        name: "days-recalc-tick",
        opts: {
          attempts: 2,
          backoff: { type: "fixed", delay: 60_000 },
        },
      },
    );
  });
});
