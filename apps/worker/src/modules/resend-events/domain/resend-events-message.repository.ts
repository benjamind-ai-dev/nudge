export type MessageStatus =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

export interface MessageRecord {
  id: string;
  businessId: string;
  sequenceRunId: string | null;
  status: MessageStatus;
  openedAt: Date | null;
  clickedAt: Date | null;
}

export interface ResendEventsMessageRepository {
  findByExternalId(externalMessageId: string): Promise<MessageRecord | null>;
  updateStatus(id: string, businessId: string, status: MessageStatus): Promise<void>;
  /**
   * Sets openedAt only if not already set (first-write-wins).
   * A zero-update result is not an error — it means the field was already set.
   */
  updateOpenedAt(id: string, businessId: string, openedAt: Date): Promise<void>;
  /**
   * Sets clickedAt only if not already set (first-write-wins).
   * A zero-update result is not an error — it means the field was already set.
   */
  updateClickedAt(id: string, businessId: string, clickedAt: Date): Promise<void>;
}

export const RESEND_EVENTS_MESSAGE_REPOSITORY = Symbol(
  "ResendEventsMessageRepository",
);
