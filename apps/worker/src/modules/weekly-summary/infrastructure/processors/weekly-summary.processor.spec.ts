import type { Job } from "bullmq";
import { JOB_NAMES } from "@nudge/shared";
import { WeeklySummaryProcessor } from "./weekly-summary.processor";

describe("WeeklySummaryProcessor", () => {
  const dispatch = { execute: jest.fn().mockResolvedValue({ enqueued: 0, skipped: 0, total: 0 }) };
  const generate = { execute: jest.fn().mockResolvedValue(undefined) };
  const proc = new WeeklySummaryProcessor(dispatch as never, generate as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates dispatch jobs to DispatchWeeklySummariesUseCase", async () => {
    await proc.process({ name: JOB_NAMES.WEEKLY_SUMMARY_DISPATCH, data: {}, id: "1" } as Job);
    expect(dispatch.execute).toHaveBeenCalled();
    expect(generate.execute).not.toHaveBeenCalled();
  });

  it("delegates business jobs to GenerateWeeklySummaryUseCase", async () => {
    await proc.process({
      name: JOB_NAMES.WEEKLY_SUMMARY_BUSINESS,
      data: { businessId: "b1", weekStartsAt: "2026-05-04" },
      id: "2",
    } as Job);
    expect(generate.execute).toHaveBeenCalledWith({ businessId: "b1", weekStartsAt: "2026-05-04" });
  });

  it("ignores unknown job names", async () => {
    await proc.process({ name: "weird", data: {}, id: "3" } as Job);
    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(generate.execute).not.toHaveBeenCalled();
  });
});
