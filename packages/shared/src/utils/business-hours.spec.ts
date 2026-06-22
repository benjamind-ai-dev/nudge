import { describe, it, expect, vi } from "vitest";
import { nextBusinessHour, firstSendAt } from "./business-hours";

describe("nextBusinessHour", () => {
  const ET = "America/New_York";

  it("returns unchanged when within business hours on Wednesday", () => {
    // Wednesday April 22, 2026 at 10am ET = 14:00 UTC
    const input = new Date("2026-04-22T14:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    expect(result).toEqual(input);
  });

  it("pushes to 9am same day when before business hours on Wednesday", () => {
    // Wednesday April 22, 2026 at 6am ET = 10:00 UTC
    const input = new Date("2026-04-22T10:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    // 9am ET = 13:00 UTC
    expect(result).toEqual(new Date("2026-04-22T13:00:00.000Z"));
  });

  it("pushes to 9am next day when after business hours on Wednesday", () => {
    // Wednesday April 22, 2026 at 6pm ET = 22:00 UTC
    const input = new Date("2026-04-22T22:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    // Thursday April 23, 9am ET = 13:00 UTC
    expect(result).toEqual(new Date("2026-04-23T13:00:00.000Z"));
  });

  it("pushes to Monday 9am when on Saturday", () => {
    // Saturday April 25, 2026 at 10am ET = 14:00 UTC
    const input = new Date("2026-04-25T14:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    // Monday April 27, 9am ET = 13:00 UTC
    expect(result).toEqual(new Date("2026-04-27T13:00:00.000Z"));
  });

  it("pushes to Monday 9am when on Sunday", () => {
    // Sunday April 26, 2026 at 2pm ET = 18:00 UTC
    const input = new Date("2026-04-26T18:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    // Monday April 27, 9am ET = 13:00 UTC
    expect(result).toEqual(new Date("2026-04-27T13:00:00.000Z"));
  });

  it("pushes to Monday 9am when after business hours on Friday", () => {
    // Friday April 24, 2026 at 7pm ET = 23:00 UTC
    const input = new Date("2026-04-24T23:00:00.000Z");
    const result = nextBusinessHour(input, ET);
    // Monday April 27, 9am ET = 13:00 UTC
    expect(result).toEqual(new Date("2026-04-27T13:00:00.000Z"));
  });
});

describe("firstSendAt", () => {
  const TZ = "America/New_York";

  it("schedules dueDate + delayDays at 9am business tz when in the future", () => {
    // due 2099-01-10, delay 3 days => 2099-01-13 09:00 America/New_York = 14:00 UTC
    const due = new Date("2099-01-10T00:00:00Z");
    const result = firstSendAt(due, 3, TZ);
    expect(result.toISOString()).toBe("2099-01-13T14:00:00.000Z");
  });

  it("floors to now when the computed time is in the past", () => {
    // Freeze clock to a Saturday so nextBusinessHour always advances to Monday 9am,
    // ensuring the result is strictly after the frozen "now" regardless of wall-clock time.
    // Saturday 2026-04-25 14:00 UTC → in ET it's Saturday, so nextBusinessHour pushes to
    // Monday 2026-04-27 09:00 ET = 13:00 UTC.
    const frozenNow = new Date("2026-04-25T14:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenNow);
    try {
      const due = new Date("2000-01-01T00:00:00Z");
      const result = firstSendAt(due, 0, TZ);
      // Floored to now (Saturday), then pushed to Monday 9am ET = 13:00 UTC
      expect(result.toISOString()).toBe("2026-04-27T13:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ahead-of-UTC timezone: Asia/Tokyo delay 3 days", () => {
    // due 2099-01-10, delay 3 days => 2099-01-13 09:00 JST
    // JST = UTC+9, so 9am JST = 00:00 UTC → 2099-01-13T00:00:00.000Z
    // 2099-01-13 is a Tuesday → already a business hour → returned as-is
    const due = new Date("2099-01-10T00:00:00Z");
    const result = firstSendAt(due, 3, "Asia/Tokyo");
    expect(result.toISOString()).toBe("2099-01-13T00:00:00.000Z");
  });

  it("DST week behind-UTC: America/New_York delay 0 days in summer", () => {
    // due 2099-07-10, delay 0 => 2099-07-10 09:00 EDT (UTC-4)
    // 9am EDT = 13:00 UTC → 2099-07-10T13:00:00.000Z
    // 2099-07-10 is a Friday → within business hours → returned as-is
    const due = new Date("2099-07-10T00:00:00Z");
    const result = firstSendAt(due, 0, "America/New_York");
    expect(result.toISOString()).toBe("2099-07-10T13:00:00.000Z");
  });
});
