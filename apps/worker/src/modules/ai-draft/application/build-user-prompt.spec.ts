import { buildUserPrompt } from "./build-user-prompt";

describe("buildUserPrompt", () => {
  const baseInput = {
    senderName: "Sandra Owens",
    invoice: {
      invoiceNumber: "INV-1042",
      balanceDueCents: 250000,
      dueDate: new Date("2026-04-15T00:00:00Z"),
      daysOverdue: 39,
    },
    anonymizedOriginalBody: "Hi the client contact, your invoice is overdue.",
    anonymizedReplyBody: "We are disputing this charge.",
  };

  it("includes the sender name, invoice number, balance, due date, days overdue, original message and reply", () => {
    const prompt = buildUserPrompt(baseInput);
    expect(prompt).toContain("Sandra Owens");
    expect(prompt).toContain("INV-1042");
    expect(prompt).toContain("$2,500.00");
    expect(prompt).toContain("2026-04-15");
    expect(prompt).toContain("39");
    expect(prompt).toContain("the client contact");
    expect(prompt).toContain("We are disputing this charge.");
  });

  it("falls back gracefully when invoiceNumber is null", () => {
    const prompt = buildUserPrompt({
      ...baseInput,
      invoice: { ...baseInput.invoice, invoiceNumber: null },
    });
    expect(prompt).toContain("(no invoice number)");
  });
});
