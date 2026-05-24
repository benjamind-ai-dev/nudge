import { formatCents } from "@nudge/shared";
import { format } from "date-fns";

export interface BuildUserPromptInput {
  senderName: string;
  invoice: {
    invoiceNumber: string | null;
    balanceDueCents: number;
    dueDate: Date;
    daysOverdue: number;
  };
  anonymizedOriginalBody: string;
  anonymizedReplyBody: string;
}

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const invoiceLabel = input.invoice.invoiceNumber ?? "(no invoice number)";
  const balance = formatCents(input.invoice.balanceDueCents);
  const dueDate = format(input.invoice.dueDate, "yyyy-MM-dd");

  return [
    `Sender name: ${input.senderName}`,
    `Invoice number: ${invoiceLabel}`,
    `Balance due: ${balance}`,
    `Due date: ${dueDate}`,
    `Days overdue: ${input.invoice.daysOverdue}`,
    "",
    "Original follow-up message we sent:",
    input.anonymizedOriginalBody,
    "",
    "Client's reply:",
    input.anonymizedReplyBody,
    "",
    "Draft a polite, professional reply (under 150 words) that we will send back. Sign off with the sender's name.",
  ].join("\n");
}
