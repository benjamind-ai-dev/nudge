import { anonymize, deAnonymize, stripEmails } from "./anonymizer";

describe("anonymizer", () => {
  describe("anonymize", () => {
    it("replaces company and contact names case-insensitively at word boundaries", () => {
      const result = anonymize("Midwest Plastics owes us. Talk to John Miller.", {
        companyName: "Midwest Plastics",
        contactName: "John Miller",
      });
      expect(result.text).toBe("the client owes us. Talk to the client contact.");
    });

    it("does not over-match inside other words", () => {
      const result = anonymize("Apples are tasty. Apple Inc paid late.", {
        companyName: "Apple Inc",
        contactName: null,
      });
      expect(result.text).toBe("Apples are tasty. the client paid late.");
    });

    it("strips emails", () => {
      const result = anonymize("Reach me at john.miller@example.co.uk anytime.", {
        companyName: "Midwest Plastics",
        contactName: "John Miller",
      });
      expect(result.text).not.toContain("@");
      expect(result.text).not.toContain("example");
    });

    it("handles null contactName gracefully", () => {
      const result = anonymize("Midwest Plastics replied.", {
        companyName: "Midwest Plastics",
        contactName: null,
      });
      expect(result.text).toBe("the client replied.");
    });

    it("returns placeholder labels for de-anonymization", () => {
      const result = anonymize("x", { companyName: "Acme", contactName: "Bob" });
      expect(result.placeholders).toEqual({
        company: "the client",
        contact: "the client contact",
      });
    });
  });

  describe("deAnonymize", () => {
    it("reverses placeholders back to real names, contact first", () => {
      // Critical: 'the client contact' contains 'the client'. Contact MUST be replaced first.
      const out = deAnonymize(
        "the client contact agreed. the client will pay Friday.",
        { companyName: "Midwest Plastics", contactName: "John Miller" },
        { company: "the client", contact: "the client contact" },
      );
      expect(out).toBe("John Miller agreed. Midwest Plastics will pay Friday.");
    });

    it("is case-insensitive", () => {
      const out = deAnonymize(
        "The Client Contact agreed. The Client will follow up.",
        { companyName: "Acme", contactName: "Bob" },
        { company: "the client", contact: "the client contact" },
      );
      expect(out).toBe("Bob agreed. Acme will follow up.");
    });

    it("leaves text alone when AI didn't use placeholders", () => {
      const out = deAnonymize(
        "Thanks for reaching out, we'll follow up tomorrow.",
        { companyName: "Acme", contactName: "Bob" },
        { company: "the client", contact: "the client contact" },
      );
      expect(out).toBe("Thanks for reaching out, we'll follow up tomorrow.");
    });

    it("handles null contactName by only replacing company", () => {
      const out = deAnonymize(
        "the client paid us.",
        { companyName: "Acme", contactName: null },
        { company: "the client", contact: "the client contact" },
      );
      expect(out).toBe("Acme paid us.");
    });
  });

  describe("stripEmails", () => {
    it("removes standard email addresses", () => {
      expect(stripEmails("Contact a@b.com or x.y+tag@sub.co.uk please.")).toBe(
        "Contact  or  please.",
      );
    });
  });
});
