export interface AnonymizationMap {
  companyName: string;
  contactName: string | null;
}

export interface AnonymizedText {
  text: string;
  placeholders: { company: string; contact: string };
}

const COMPANY_PLACEHOLDER = "the client";
const CONTACT_PLACEHOLDER = "the client contact";
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryReplaceAll(input: string, needle: string, replacement: string): string {
  if (!needle) return input;
  const pattern = new RegExp(`\\b${escapeRegex(needle)}\\b`, "gi");
  return input.replace(pattern, replacement);
}

export function anonymize(text: string, map: AnonymizationMap): AnonymizedText {
  let out = text;
  if (map.contactName) {
    out = wordBoundaryReplaceAll(out, map.contactName, CONTACT_PLACEHOLDER);
  }
  out = wordBoundaryReplaceAll(out, map.companyName, COMPANY_PLACEHOLDER);
  out = stripEmails(out);
  return {
    text: out,
    placeholders: { company: COMPANY_PLACEHOLDER, contact: CONTACT_PLACEHOLDER },
  };
}

export function deAnonymize(
  text: string,
  original: AnonymizationMap,
  placeholders: { company: string; contact: string },
): string {
  let out = text;
  // Order matters: contact placeholder is a superstring of company placeholder.
  // Replace contact first to avoid corrupting "the client contact" by replacing
  // the embedded "the client" first and leaving " contact" dangling.
  if (original.contactName) {
    out = wordBoundaryReplaceAll(out, placeholders.contact, original.contactName);
  }
  out = wordBoundaryReplaceAll(out, placeholders.company, original.companyName);
  return out;
}

export function stripEmails(text: string): string {
  return text.replace(EMAIL_REGEX, "");
}
