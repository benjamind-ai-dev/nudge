export type MessageChannel = "email" | "sms";

export interface MessageListItem {
  id: string;
  channel: MessageChannel;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  repliedAt: Date | null;
  hasReply: boolean;
  customer: { id: string; companyName: string };
  invoice: { id: string; invoiceNumber: string | null };
}

export interface MessageDetail extends MessageListItem {
  body: string;
  replyBody: string | null;
  aiDraftResponse: string | null;
  sequenceRun: { id: string; status: string };
  sequenceStep: { stepOrder: number; name: string } | null;
}
