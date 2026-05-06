import { DispatchWeeklySummariesUseCase, type DispatchClock, type BusinessTimezoneReader, type WeeklySummaryQueueProducer } from "./dispatch-weekly-summaries.use-case";

const makeDeps = () => {
  const clock: jest.Mocked<DispatchClock> = { now: jest.fn() };
  const reader: jest.Mocked<BusinessTimezoneReader> = { listAll: jest.fn() };
  const producer: jest.Mocked<WeeklySummaryQueueProducer> = {
    enqueueBusiness: jest.fn().mockResolvedValue(undefined),
    summaryExists: jest.fn().mockResolvedValue(false),
  };
  return { clock, reader, producer };
};

describe("DispatchWeeklySummariesUseCase", () => {
  it("enqueues businesses where local time is Mon 8am", async () => {
    const deps = makeDeps();
    deps.clock.now.mockReturnValue(new Date("2026-05-04T12:00:00Z")); // Mon 12:00 UTC == Mon 8am ET
    deps.reader.listAll.mockResolvedValue([
      { id: "b1", timezone: "America/New_York" },
    ]);

    const useCase = new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer);
    const result = await useCase.execute();

    expect(deps.producer.enqueueBusiness).toHaveBeenCalledWith({ businessId: "b1", weekStartsAt: "2026-05-04" });
    expect(result.enqueued).toBe(1);
  });

  it("includes 9am and 10am within the local window", async () => {
    const deps = makeDeps();
    deps.clock.now.mockReturnValue(new Date("2026-05-04T13:30:00Z")); // 9:30am ET
    deps.reader.listAll.mockResolvedValue([{ id: "b1", timezone: "America/New_York" }]);

    await new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer).execute();

    expect(deps.producer.enqueueBusiness).toHaveBeenCalled();
  });

  it("excludes 11am local", async () => {
    const deps = makeDeps();
    deps.clock.now.mockReturnValue(new Date("2026-05-04T15:00:00Z")); // 11am ET
    deps.reader.listAll.mockResolvedValue([{ id: "b1", timezone: "America/New_York" }]);

    await new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer).execute();

    expect(deps.producer.enqueueBusiness).not.toHaveBeenCalled();
  });

  it("excludes non-Monday weekdays", async () => {
    const deps = makeDeps();
    deps.clock.now.mockReturnValue(new Date("2026-05-05T12:00:00Z")); // Tuesday 8am ET
    deps.reader.listAll.mockResolvedValue([{ id: "b1", timezone: "America/New_York" }]);

    await new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer).execute();

    expect(deps.producer.enqueueBusiness).not.toHaveBeenCalled();
  });

  it("skips businesses that already have a summary row this week", async () => {
    const deps = makeDeps();
    deps.clock.now.mockReturnValue(new Date("2026-05-04T12:00:00Z"));
    deps.reader.listAll.mockResolvedValue([{ id: "b1", timezone: "America/New_York" }]);
    deps.producer.summaryExists.mockResolvedValueOnce(true);

    const result = await new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer).execute();

    expect(deps.producer.enqueueBusiness).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("handles a DST timezone correctly", async () => {
    const deps = makeDeps();
    // March 9, 2026 is Monday; 13:00 UTC is 9:00am EDT (after spring-forward).
    deps.clock.now.mockReturnValue(new Date("2026-03-09T13:00:00Z"));
    deps.reader.listAll.mockResolvedValue([{ id: "b1", timezone: "America/New_York" }]);

    await new DispatchWeeklySummariesUseCase(deps.clock, deps.reader, deps.producer).execute();

    expect(deps.producer.enqueueBusiness).toHaveBeenCalledWith({
      businessId: "b1",
      weekStartsAt: "2026-03-09",
    });
  });
});
