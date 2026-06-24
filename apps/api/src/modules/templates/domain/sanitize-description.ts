// Strips PII from a free-text template description before it is sent to the
// Claude API. Compliance requirement: never send un-anonymized PII to the model
// (see .claude/rules/forbidden.rule.md). A template description is free text, so
// there is no customer entity map to anonymize against (unlike the worker's
// ai-draft flow) — the concrete, structured PII we can reliably remove here is
// email addresses. Names/amounts a user types are mitigated by framing the
// description as untrusted data in the prompt (see the system prompt + client).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Strips the XML delimiter tags used to fence the description in the prompt so a
// crafted payload cannot break out of the fence (prompt-injection mitigation).
const DESCRIPTION_TAG_RE = /<\/?\s*description\s*>/gi;

export function stripEmails(text: string): string {
  return text.replace(EMAIL_RE, "[email removed]");
}

export function sanitizeTemplateDescription(text: string): string {
  return stripEmails(text).replace(DESCRIPTION_TAG_RE, "");
}
