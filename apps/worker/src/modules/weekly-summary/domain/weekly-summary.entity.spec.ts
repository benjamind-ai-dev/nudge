import { WeeklySummary, WeeklySummaryStatus } from "./weekly-summary.entity";

describe("WeeklySummary", () => {
  it("starts in pending status", () => {
    const s = WeeklySummary.create({ id: "s1", businessId: "b1", weekStartsAt: "2026-05-04" });
    expect(s.status).toBe<WeeklySummaryStatus>("pending");
  });

  it("transitions pending → skipped with metrics", () => {
    const s = WeeklySummary.create({ id: "s1", businessId: "b1", weekStartsAt: "2026-05-04" });
    const skipped = s.markSkipped({ recoveredThisWeekCents: 0 } as never);
    expect(skipped.status).toBe<WeeklySummaryStatus>("skipped");
    expect(skipped.metrics).toEqual({ recoveredThisWeekCents: 0 });
  });

  it("transitions pending → sent with all the send metadata", () => {
    const s = WeeklySummary.create({ id: "s1", businessId: "b1", weekStartsAt: "2026-05-04" });
    const sent = s.markSent({
      aiParagraph: "hello",
      aiModel: "claude-sonnet-4-6",
      aiInputTokens: 100,
      aiOutputTokens: 50,
      metrics: { recoveredThisWeekCents: 5000 } as never,
      recipientEmails: ["a@b.com"],
      resendMessageIds: ["rs_1"],
      sentAt: new Date("2026-05-05T08:00:00Z"),
    });
    expect(sent.status).toBe("sent");
    expect(sent.aiParagraph).toBe("hello");
    expect(sent.recipientEmails).toEqual(["a@b.com"]);
  });

  it("transitions pending → failed with an error message", () => {
    const s = WeeklySummary.create({ id: "s1", businessId: "b1", weekStartsAt: "2026-05-04" });
    const failed = s.markFailed("no owner users");
    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toBe("no owner users");
  });

  it("rejects transitions out of a terminal status", () => {
    const s = WeeklySummary.create({ id: "s1", businessId: "b1", weekStartsAt: "2026-05-04" });
    const sent = s.markSent({
      aiParagraph: null,
      aiModel: null,
      aiInputTokens: null,
      aiOutputTokens: null,
      metrics: {} as never,
      recipientEmails: ["x@y.com"],
      resendMessageIds: ["rs"],
      sentAt: new Date(),
    });
    expect(() => sent.markFailed("nope")).toThrow();
  });
});
