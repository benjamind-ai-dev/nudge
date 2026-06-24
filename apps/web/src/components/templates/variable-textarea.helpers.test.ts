import { describe, expect, it } from "vitest";
import { applySuggestion, detectTrigger, insertToken } from "./variable-textarea.helpers";

describe("insertToken", () => {
  it("inserts at caret in the middle of text", () => {
    const result = insertToken("Hello world", 5, 5, "{{name}}");
    expect(result.value).toBe("Hello{{name}} world");
    expect(result.caret).toBe(13); // 5 + "{{name}}".length (8)
  });

  it("replaces a selection", () => {
    const result = insertToken("Hello SELECTED world", 6, 14, "{{name}}");
    expect(result.value).toBe("Hello {{name}} world");
    expect(result.caret).toBe(14); // 6 + "{{name}}".length (8)
  });

  it("caret lands right after the inserted token", () => {
    const result = insertToken("abc", 3, 3, "{{x}}");
    expect(result.value).toBe("abc{{x}}");
    expect(result.caret).toBe(8); // 3 + 5
  });

  it("inserts at position 0", () => {
    const result = insertToken("world", 0, 0, "{{greeting}} ");
    expect(result.value).toBe("{{greeting}} world");
    expect(result.caret).toBe(13);
  });
});

describe("detectTrigger", () => {
  it("returns partial and start for '{{con' at index 3", () => {
    const result = detectTrigger("Hi {{con");
    expect(result).toEqual({ partial: "con", start: 3 });
  });

  it("returns empty partial and correct start for '{{' at end", () => {
    const result = detectTrigger("x {{");
    expect(result).toEqual({ partial: "", start: 2 });
  });

  it("returns null for text with no trigger", () => {
    expect(detectTrigger("no trigger")).toBeNull();
  });

  it("returns null when the trigger is closed (followed by }})", () => {
    // Text before caret ends with a closed token — no open trigger
    expect(detectTrigger("{{done}} ")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(detectTrigger("")).toBeNull();
  });

  it("matches only the last open trigger when multiple exist", () => {
    // First {{foo}} is closed, second {{ is still open
    const result = detectTrigger("{{foo}} bar {{par");
    expect(result).toEqual({ partial: "par", start: 12 });
  });
});

describe("applySuggestion", () => {
  it("replaces open {{partial with the completed {{name}} token", () => {
    // "Hi {{con" — triggerStart=3, caret=8, partial is "con" (3 chars after "{{")
    const result = applySuggestion("Hi {{con", 3, 8, "contact_name");
    expect(result.value).toBe("Hi {{contact_name}}");
    expect(result.caret).toBe(19); // 3 + "{{contact_name}}".length (16)
  });

  it("preserves text after the caret", () => {
    // "Hello {{nam" with caret at end (index 11), text after caret is " world"
    const result = applySuggestion("Hello {{nam world", 6, 11, "name");
    expect(result.value).toBe("Hello {{name}} world");
    expect(result.caret).toBe(14); // 6 + "{{name}}".length (8)
  });

  it("works when trigger is at the very start", () => {
    const result = applySuggestion("{{inv", 0, 5, "invoice_number");
    expect(result.value).toBe("{{invoice_number}}");
    expect(result.caret).toBe(18);
  });
});
