import { nextBusinessHour } from "./business-hours";

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
