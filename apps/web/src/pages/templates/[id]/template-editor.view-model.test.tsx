import { describe, expect, it } from "vitest";
import { resolveVariables, SAMPLE_DATA } from "./template-editor.view-model";

describe("resolveVariables", () => {
  it("replaces known tokens with sample values", () => {
    expect(resolveVariables("Hi {{contact_name}}")).toBe(`Hi ${SAMPLE_DATA.contact_name}`);
  });

  it("tolerates internal whitespace in tokens", () => {
    expect(resolveVariables("Inv {{ invoice_number }}")).toBe(`Inv ${SAMPLE_DATA.invoice_number}`);
  });

  it("leaves unknown tokens literal so authors see typos", () => {
    expect(resolveVariables("Hi {{frist_name}}")).toBe("Hi {{frist_name}}");
  });
});
