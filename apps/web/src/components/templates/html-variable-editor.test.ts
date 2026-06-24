import { describe, expect, it } from "vitest";
import { computeVariableCompletion } from "./variable-completion";

const VARS = ["contact_name", "company_name", "invoice_number", "payment_link"];

describe("computeVariableCompletion", () => {
  it("returns a result when the cursor is in a {{ context", () => {
    const result = computeVariableCompletion("Hi {{con", VARS);
    expect(result).not.toBeNull();
    expect(result!.options.map((o) => o.label)).toContain("contact_name");
  });

  it("from points just AFTER the {{ (so CodeMirror matches the partial, not the braces)", () => {
    // text = "Hi {{con" → {{ at index 3, partial starts at index 5
    const result = computeVariableCompletion("Hi {{con", VARS);
    expect(result!.from).toBe(5);
  });

  it("returns ALL variables and lets CodeMirror filter by the partial", () => {
    // No filtering here — CM narrows the list against the typed partial in the UI.
    const result = computeVariableCompletion("{{xyz", VARS);
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(VARS.length);
  });

  it("returns all variables for a bare {{", () => {
    const result = computeVariableCompletion("Hello {{", VARS);
    expect(result!.options).toHaveLength(VARS.length);
  });

  it("apply adds the variable name + closing braces (the {{ already typed stays)", () => {
    const result = computeVariableCompletion("{{x", VARS);
    const paymentLink = result!.options.find((o) => o.label === "payment_link");
    expect(paymentLink!.apply).toBe("payment_link}}");
  });

  it("returns null when there is no {{ trigger", () => {
    expect(computeVariableCompletion("no trigger here", VARS)).toBeNull();
  });

  it("returns null when the trigger is already closed", () => {
    // {{done}} — /\{\{(\w*)$/ won't match because the `}}` interrupts it
    expect(computeVariableCompletion("{{done}} ", VARS)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(computeVariableCompletion("", VARS)).toBeNull();
  });

  it("anchors on the LAST open trigger when multiple exist", () => {
    const text = "{{contact_name}} foo {{pay";
    const result = computeVariableCompletion(text, VARS);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(text.lastIndexOf("{{") + 2);
  });
});
