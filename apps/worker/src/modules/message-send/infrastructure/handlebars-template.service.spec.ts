import Handlebars from "handlebars";
import { HandlebarsTemplateService } from "./handlebars-template.service";
import type { TemplateData } from "../domain/template.service";

describe("HandlebarsTemplateService", () => {
  let service: HandlebarsTemplateService;

  beforeEach(() => {
    service = new HandlebarsTemplateService();
  });

  const templateData: TemplateData = {
    company_name: "Acme Corp",
    contact_name: "Sarah",
    invoice_number: "INV-001",
    amount: "$1,000.00",
    balance_due: "$1,000.00",
    due_date: "Apr 10, 2026",
    days_overdue: 5,
    payment_link: "https://pay.example.com/inv-1",
    sender_name: "Bob Smith",
  };

  it("renders contact and company variables", () => {
    const template = "Hello {{contact_name}} from {{company_name}}";
    const result = service.render("step-1", template, templateData);
    expect(result).toBe("Hello Sarah from Acme Corp");
  });

  it("renders invoice variables", () => {
    const template = "Invoice {{invoice_number}} for {{amount}}";
    const result = service.render("step-2", template, templateData);
    expect(result).toBe("Invoice INV-001 for $1,000.00");
  });

  it("renders sender_name variable", () => {
    const template = "From: {{sender_name}}";
    const result = service.render("step-3", template, templateData);
    expect(result).toBe("From: Bob Smith");
  });

  it("renders days_overdue as number", () => {
    const template = "Your invoice is {{days_overdue}} days overdue";
    const result = service.render("step-4", template, templateData);
    expect(result).toBe("Your invoice is 5 days overdue");
  });

  it("renders payment_link", () => {
    const template = "Pay here: {{payment_link}}";
    const result = service.render("step-5", template, templateData);
    expect(result).toBe("Pay here: https://pay.example.com/inv-1");
  });

  describe("template caching", () => {
    let compileSpy: jest.SpyInstance;

    beforeEach(() => {
      compileSpy = jest.spyOn(Handlebars, "compile");
    });

    afterEach(() => {
      compileSpy.mockRestore();
    });

    it("caches compiled templates and only compiles once", () => {
      const template = "Test {{company_name}}";

      const result1 = service.render("cache-test", template, templateData);
      const result2 = service.render("cache-test", template, templateData);
      const result3 = service.render("cache-test", template, templateData);

      expect(result1).toBe(result2);
      expect(result1).toBe(result3);
      expect(result1).toBe("Test Acme Corp");
      expect(compileSpy).toHaveBeenCalledTimes(1);
    });

    it("invalidates cache and recompiles when template content changes", () => {
      const cacheKey = "editable-step";
      const templateV1 = "Version 1: {{company_name}}";
      const templateV2 = "Version 2: {{company_name}}";

      const result1 = service.render(cacheKey, templateV1, templateData);
      expect(result1).toBe("Version 1: Acme Corp");
      expect(compileSpy).toHaveBeenCalledTimes(1);

      const result2 = service.render(cacheKey, templateV2, templateData);
      expect(result2).toBe("Version 2: Acme Corp");
      expect(compileSpy).toHaveBeenCalledTimes(2);
    });

    it("evicts oldest entries when cache exceeds max size", () => {
      const maxSize = (service as unknown as { maxCacheSize: number }).maxCacheSize;
      const template = "Hello {{company_name}}";

      for (let i = 0; i < maxSize + 10; i++) {
        service.render(`step-${i}`, template, templateData);
      }

      const cacheSize = (service as unknown as { cache: Map<string, unknown> }).cache.size;
      expect(cacheSize).toBeLessThanOrEqual(maxSize);
    });
  });

  it("handles null values gracefully", () => {
    const dataWithNulls: TemplateData = {
      ...templateData,
      contact_name: null,
      payment_link: null,
    };

    const template = "Hi {{contact_name}}, link: {{payment_link}}";
    const result = service.render("null-test", template, dataWithNulls);
    expect(result).toBe("Hi , link: ");
  });
});
