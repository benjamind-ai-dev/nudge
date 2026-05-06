import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { JOB_NAMES, QUEUE_NAMES } from "@nudge/shared";
import { DevController } from "./dev.controller";
import { DevKeyGuard } from "./infrastructure/dev-key.guard";
import type { Env } from "../../common/config/env.schema";

const mockQueue = {
  add: jest.fn(),
};

const allowingConfig = {
  get: (key: keyof Env) => (key === "DEV_MODE" ? true : key === "DEV_API_KEY" ? "secretsecretsecret" : undefined),
} as unknown as ConfigService<Env, true>;

describe("DevController.triggerWeeklySummary", () => {
  let controller: DevController;

  beforeEach(async () => {
    mockQueue.add.mockReset();
    mockQueue.add.mockResolvedValue({ id: "job-123" });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevController],
      providers: [
        DevKeyGuard,
        { provide: ConfigService, useValue: allowingConfig },
        { provide: getQueueToken(QUEUE_NAMES.WEEKLY_SUMMARY), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get(DevController);
  });

  it("enqueues a weekly-summary-business job with the provided weekStartsAt", async () => {
    const result = await controller.triggerWeeklySummary({
      businessId: "11111111-1111-1111-1111-111111111111",
      weekStartsAt: "2026-05-04",
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      JOB_NAMES.WEEKLY_SUMMARY_BUSINESS,
      { businessId: "11111111-1111-1111-1111-111111111111", weekStartsAt: "2026-05-04" },
      { attempts: 1 },
    );
    expect(result).toEqual({
      data: {
        jobId: "job-123",
        businessId: "11111111-1111-1111-1111-111111111111",
        weekStartsAt: "2026-05-04",
      },
    });
  });

  it("defaults weekStartsAt to the most recent Monday in UTC when omitted", async () => {
    const today = new Date();
    const day = today.getUTCDay();
    const offset = (day + 6) % 7;
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - offset);
    const expected = monday.toISOString().slice(0, 10);

    await controller.triggerWeeklySummary({
      businessId: "22222222-2222-2222-2222-222222222222",
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      JOB_NAMES.WEEKLY_SUMMARY_BUSINESS,
      { businessId: "22222222-2222-2222-2222-222222222222", weekStartsAt: expected },
      { attempts: 1 },
    );
  });
});
