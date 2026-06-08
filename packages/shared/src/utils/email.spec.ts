import { describe, it, expect } from "vitest";
import { newlinesToHtml } from "./email";

describe("newlinesToHtml", () => {
  it("converts a single \\n to <br>", () => {
    expect(newlinesToHtml("Hello\nWorld")).toBe("Hello<br>World");
  });

  it("converts \\r\\n to <br>", () => {
    expect(newlinesToHtml("Hello\r\nWorld")).toBe("Hello<br>World");
  });

  it("converts multiple consecutive \\n to multiple <br>", () => {
    expect(newlinesToHtml("Para one\n\nPara two")).toBe("Para one<br><br>Para two");
  });

  it("converts multiple consecutive \\r\\n to multiple <br>", () => {
    expect(newlinesToHtml("Para one\r\n\r\nPara two")).toBe("Para one<br><br>Para two");
  });

  it("passes through a string with no newlines unchanged", () => {
    expect(newlinesToHtml("No newlines here")).toBe("No newlines here");
  });

  it("returns an empty string unchanged", () => {
    expect(newlinesToHtml("")).toBe("");
  });

  it("does not HTML-escape angle brackets or ampersands", () => {
    expect(newlinesToHtml("<b>bold</b> & \"quoted\"")).toBe("<b>bold</b> & \"quoted\"");
  });

  it("handles a mix of \\r\\n and \\n", () => {
    expect(newlinesToHtml("line1\r\nline2\nline3")).toBe("line1<br>line2<br>line3");
  });
});
