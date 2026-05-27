import { GetDashboardSummaryUseCase } from "./get-dashboard-summary.use-case";
import type { DashboardSummaryRepository } from "../domain/dashboard-summary.repository";
import { BusinessNotFoundError } from "../../business/domain/business.errors";

const BIZ_ID = "11111111-1111-1111-1111-111111111111";

function createMockRepo(
  overrides: Partial<DashboardSummaryRepository> = {},
): jest.Mocked<DashboardSummaryRepository> {
  return {
    getBusinessTimezone: jest.fn().mockResolvedValue("America/New_York"),
    getOutstanding: jest.fn().mockResolvedValue({ totalCents: 0, count: 0 }),
    getRecoveredForMonth: jest.fn().mockResolvedValue({ totalCents: 0 }),
    getAvgDaysToPayBetween: jest.fn().mockResolvedValue(0),
    countActiveSequences: jest.fn().mockResolvedValue(0),
    getAgingBuckets: jest.fn().mockResolvedValue({
      current: { totalCents: 0, count: 0 },
      days1to30: { totalCents: 0, count: 0 },
      days31to60: { totalCents: 0, count: 0 },
      days61to90: { totalCents: 0, count: 0 },
      days90plus: { totalCents: 0, count: 0 },
    }),
    ...overrides,
  } as jest.Mocked<DashboardSummaryRepository>;
}

describe("GetDashboardSummaryUseCase", () => {
  it("throws BusinessNotFoundError when timezone lookup returns null", async () => {
    const repo = createMockRepo({
      getBusinessTimezone: jest.fn().mockResolvedValue(null),
    });
    const useCase = new GetDashboardSummaryUseCase(repo);

    await expect(useCase.execute(BIZ_ID)).rejects.toBeInstanceOf(BusinessNotFoundError);
    expect(repo.getOutstanding).not.toHaveBeenCalled();
  });

  it("returns a zeroed summary when the business has no data", async () => {
    const repo = createMockRepo();
    const useCase = new GetDashboardSummaryUseCase(repo);

    const result = await useCase.execute(BIZ_ID);

    expect(result.outstanding).toEqual({ totalCents: 0, count: 0 });
    expect(result.recoveredThisMonth).toEqual({ totalCents: 0, pctChangeVsLastMonth: 0 });
    expect(result.avgDaysToPay).toEqual({ currentDays: 0, previousDays: 0 });
    expect(result.activeSequences).toEqual({ count: 0 });
    expect(result.aging.current).toEqual({ totalCents: 0, count: 0 });
  });

  it("computes pct change vs last month from recovered totals", async () => {
    const repo = createMockRepo({
      getRecoveredForMonth: jest.fn(async (_b, _tz, monthsAgo: 0 | 1) =>
        monthsAgo === 0 ? { totalCents: 12000 } : { totalCents: 10000 },
      ),
    });
    const useCase = new GetDashboardSummaryUseCase(repo);

    const result = await useCase.execute(BIZ_ID);

    expect(result.recoveredThisMonth.totalCents).toBe(12000);
    expect(result.recoveredThisMonth.pctChangeVsLastMonth).toBeCloseTo(20, 5);
  });

  it("returns pctChange = 0 when prior month total is 0 (avoid divide-by-zero)", async () => {
    const repo = createMockRepo({
      getRecoveredForMonth: jest.fn(async (_b, _tz, monthsAgo: 0 | 1) =>
        monthsAgo === 0 ? { totalCents: 5000 } : { totalCents: 0 },
      ),
    });
    const useCase = new GetDashboardSummaryUseCase(repo);

    const result = await useCase.execute(BIZ_ID);

    expect(result.recoveredThisMonth.pctChangeVsLastMonth).toBe(0);
  });

  it("passes contiguous 30-day windows to getAvgDaysToPayBetween", async () => {
    const repo = createMockRepo();
    const useCase = new GetDashboardSummaryUseCase(repo);
    const fixedNow = new Date("2026-05-27T12:00:00.000Z");
    const RealDate = Date;
    jest.spyOn(globalThis, "Date").mockImplementation(((arg?: unknown) =>
      arg === undefined ? fixedNow : new RealDate(arg as never)) as never);

    await useCase.execute(BIZ_ID);

    const calls = repo.getAvgDaysToPayBetween.mock.calls;
    expect(calls).toHaveLength(2);
    // Current window: [now - 30d, now)
    expect(calls[0][1].toISOString()).toBe("2026-04-27T12:00:00.000Z");
    expect(calls[0][2].toISOString()).toBe("2026-05-27T12:00:00.000Z");
    // Prior window: [now - 60d, now - 30d)
    expect(calls[1][1].toISOString()).toBe("2026-03-28T12:00:00.000Z");
    expect(calls[1][2].toISOString()).toBe("2026-04-27T12:00:00.000Z");

    jest.restoreAllMocks();
  });
});
