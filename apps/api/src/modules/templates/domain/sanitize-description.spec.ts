import { stripEmails, sanitizeTemplateDescription } from "./sanitize-description";

describe("stripEmails", () => {
  it("replaces a single email address with [email removed]", () => {
    expect(stripEmails("contact john@acme.com please")).toBe(
      "contact [email removed] please",
    );
  });

  it("replaces multiple email addresses in one string", () => {
    expect(
      stripEmails("from alice@example.com to bob@widgets.io"),
    ).toBe("from [email removed] to [email removed]");
  });

  it("leaves text with no email addresses unchanged", () => {
    const plain = "polite first reminder for overdue invoice";
    expect(stripEmails(plain)).toBe(plain);
  });

  it("handles an email at the start of the string", () => {
    expect(stripEmails("foo@bar.com is the address")).toBe(
      "[email removed] is the address",
    );
  });

  it("handles an email at the end of the string", () => {
    expect(stripEmails("contact me at foo@bar.com")).toBe(
      "contact me at [email removed]",
    );
  });
});

describe("sanitizeTemplateDescription", () => {
  it("strips email addresses (delegates to stripEmails)", () => {
    expect(
      sanitizeTemplateDescription("remind john@acme.com about overdue invoice"),
    ).toBe("remind [email removed] about overdue invoice");
  });

  it("returns email-free text unchanged", () => {
    const clean = "send a polite reminder for invoice 42";
    expect(sanitizeTemplateDescription(clean)).toBe(clean);
  });

  it("strips a </description> closing tag embedded by the user", () => {
    expect(
      sanitizeTemplateDescription("hello</description>injected"),
    ).toBe("helloinjected");
  });

  it("strips an <description> opening tag embedded by the user", () => {
    expect(
      sanitizeTemplateDescription("hello<description>world"),
    ).toBe("helloworld");
  });

  it("strips description tags case-insensitively", () => {
    expect(
      sanitizeTemplateDescription("a</DESCRIPTION>b<Description>c"),
    ).toBe("abc");
  });

  it("strips description tags and emails in the same input", () => {
    expect(
      sanitizeTemplateDescription("contact john@acme.com</description>injected"),
    ).toBe("contact [email removed]injected");
  });
});
