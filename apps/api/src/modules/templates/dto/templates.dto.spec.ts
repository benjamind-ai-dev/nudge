import { generateTemplateSchema } from "./templates.dto";

describe("generateTemplateSchema", () => {
  it("accepts a description at the minimum length (1 char)", () => {
    const result = generateTemplateSchema.safeParse({ description: "a" });
    expect(result.success).toBe(true);
  });

  it("accepts a description at exactly 2000 chars", () => {
    const result = generateTemplateSchema.safeParse({
      description: "a".repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a description over 2000 chars", () => {
    const result = generateTemplateSchema.safeParse({
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.description).toBeDefined();
    }
  });

  it("rejects an empty description", () => {
    const result = generateTemplateSchema.safeParse({ description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing description", () => {
    const result = generateTemplateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
