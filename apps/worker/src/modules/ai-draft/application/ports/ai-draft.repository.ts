export const AI_DRAFT_REPOSITORY = Symbol("AI_DRAFT_REPOSITORY");

export interface AiDraftMessageContext {
  message: {
    id: string;
    body: string;
    replyBody: string | null;
  };
  invoice: {
    invoiceNumber: string | null;
    balanceDueCents: number;
    currency: string;
    dueDate: Date;
    daysOverdue: number;
  };
  customer: {
    companyName: string;
    contactName: string | null;
  };
  business: {
    senderName: string;
  };
}

export interface AiDraftRepository {
  findMessageContext(
    messageId: string,
    businessId: string,
  ): Promise<AiDraftMessageContext | null>;

  saveDraft(
    messageId: string,
    businessId: string,
    draft: string | null,
  ): Promise<void>;
}
