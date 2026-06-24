import { describe, expect, it } from "vitest";
import { computeVariableCompletion } from "./variable-completion";

const VARS = ["contact_name", "company_name", "invoice_number", "payment_link"];

describe("computeVariableCompletion", () => {
  it("returns options matching a partial after {{", () => {
    // "con" matches contact_name (starts with "con") but NOT company_name ("com") or invoice_number
    const result = computeVariableCompletion("Hi {{con", VARS);
    expect(result).not.toBeNull();
    expect(result!.options.map((o) => o.label)).toContain("contact_name");
    expect(result!.options.map((o) => o.label)).not.toContain("company_name");
    expect(result!.options.map((o) => o.label)).not.toContain("invoice_number");
  });

  it("from points to the position of {{ in the text", () => {
    // text = "Hi {{con" → {{ is at index 3
    const result = computeVariableCompletion("Hi {{con", VARS);
    expect(result!.from).toBe(3);
  });

  it("returns all variables for bare {{", () => {
    const result = computeVariableCompletion("Hello {{", VARS);
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(VARS.length);
  });

  it("sets apply to the full {{name}} token", () => {
    const result = computeVariableCompletion("{{pay", VARS);
    expect(result!.options[0].apply).toBe("{{payment_link}}");
  });

  it("returns null when there is no {{ trigger", () => {
    expect(computeVariableCompletion("no trigger here", VARS)).toBeNull();
  });

  it("returns null when the trigger is already closed", () => {
    // {{done}} — the regex /\{\{(\w*)$/ won't match because the `}}` interrupts it
    expect(computeVariableCompletion("{{done}} ", VARS)).toBeNull();
  });

  it("returns null when no variable matches the partial", () => {
    expect(computeVariableCompletion("{{xyz", VARS)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(computeVariableCompletion("", VARS)).toBeNull();
  });

  it("matches only the last open trigger when multiple exist", () => {
    // First {{contact_name}} is closed; second {{ is open
    const result = computeVariableCompletion("{{contact_name}} foo {{pay", VARS);
    expect(result).not.toBeNull();
    expect(result!.options[0].label).toBe("payment_link");
  });
});
