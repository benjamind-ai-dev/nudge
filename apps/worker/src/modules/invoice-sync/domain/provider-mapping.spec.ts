import { centsFromDecimal, joinContactName, parseProviderDate } from "./provider-mapping";

describe("parseProviderDate", () => {
  it("parses an ISO datetime string into a Date", () => {
    const result = parseProviderDate("2026-01-05T10:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(new Date("2026-01-05T10:00:00Z").getTime());
  });

  it("parses an ISO date-only string into a Date at UTC midnight", () => {
    const result = parseProviderDate("2026-02-01");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(new Date("2026-02-01T00:00:00.000Z").getTime());
  });

  it("parses Xero .NET /Date(ms+tz)/ format — timezone suffix is ignored, ms treated as UTC", () => {
    // 1706140800000 = 2024-01-25T00:00:00.000Z
    const result = parseProviderDate("/Date(1706140800000+0000)/");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1706140800000);
  });

  it("parses Xero .NET /Date(ms-tz)/ format — negative timezone offset suffix is also ignored", () => {
    const result = parseProviderDate("/Date(1706140800000-0500)/");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1706140800000);
  });

  it("returns null for null", () => {
    expect(parseProviderDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseProviderDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseProviderDate("")).toBeNull();
  });

  it("returns null for a malformed string", () => {
    expect(parseProviderDate("not-a-date")).toBeNull();
  });
});

describe("centsFromDecimal", () => {
  it("converts 500.25 (number) to 50025", () => {
    expect(centsFromDecimal(500.25)).toBe(50025);
  });

  it("converts '500.25' (string) to 50025", () => {
    expect(centsFromDecimal("500.25")).toBe(50025);
  });

  it("converts 0 to 0", () => {
    expect(centsFromDecimal(0)).toBe(0);
  });

  it("converts null to 0", () => {
    expect(centsFromDecimal(null)).toBe(0);
  });

  it("converts undefined to 0", () => {
    expect(centsFromDecimal(undefined)).toBe(0);
  });

  it("documents IEEE 754 drift: Math.round(1.005 * 100) === 100, not 101", () => {
    // In JavaScript, 1.005 * 100 evaluates to 100.49999999999999 due to floating-point
    // representation, so Math.round yields 100 rather than the mathematically expected 101.
    expect(centsFromDecimal(1.005)).toBe(100);
  });

  it("converts a negative value: -5.5 → -550", () => {
    expect(centsFromDecimal(-5.5)).toBe(-550);
  });

  it("converts empty string '' to 0", () => {
    expect(centsFromDecimal("")).toBe(0);
  });

  it("converts non-numeric string 'abc' to 0", () => {
    expect(centsFromDecimal("abc")).toBe(0);
  });
});

describe("joinContactName", () => {
  it("joins first and last name with a space", () => {
    expect(joinContactName("Jane", "Doe")).toBe("Jane Doe");
  });

  it("returns first name when last name is null", () => {
    expect(joinContactName("Jane", null)).toBe("Jane");
  });

  it("returns last name when first name is null", () => {
    expect(joinContactName(null, "Doe")).toBe("Doe");
  });

  it("falls back to fallback when both parts are whitespace-only", () => {
    expect(joinContactName("  ", "  ", "Acme")).toBe("Acme");
  });

  it("returns null when both parts and fallback are null", () => {
    expect(joinContactName(null, null, null)).toBeNull();
  });

  it("returns null when both parts are null and fallback is empty string", () => {
    expect(joinContactName(null, null, "")).toBeNull();
  });

  it("falls back to fallback when both parts are empty strings", () => {
    expect(joinContactName("", "", "Acme")).toBe("Acme");
  });
});
