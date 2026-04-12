import { describe, it, expect } from "vitest";
import { formatCents, formatDate } from "./format";

describe("formatCents", () => {
  it("formats zero cents", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats positive cents to dollars", () => {
    expect(formatCents(1050)).toBe("$10.50");
  });

  it("formats large amounts", () => {
    expect(formatCents(999999)).toBe("$9,999.99");
  });

  it("formats negative cents", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    const date = new Date("2026-01-15T00:00:00Z");
    expect(formatDate(date)).toBe("Jan 15, 2026");
  });

  it("formats an ISO string", () => {
    expect(formatDate("2026-06-01T12:00:00Z")).toBe("Jun 1, 2026");
  });
});
