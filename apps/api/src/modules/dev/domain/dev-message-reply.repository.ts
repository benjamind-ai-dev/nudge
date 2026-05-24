export const DEV_MESSAGE_REPLY_REPOSITORY = Symbol(
  "DEV_MESSAGE_REPLY_REPOSITORY",
);

export interface DevMessageReplyRepository {
  /**
   * Marks the message as replied by setting reply_body and replied_at, and
   * returns the row's businessId so the caller can enqueue downstream work.
   *
   * Returns null when no message with the given id exists.
   *
   * DEV-ONLY: not businessId-scoped on the update — this method exists solely
   * to exercise the ai-draft queue from a dev-key-gated endpoint.
   * Never expose this pattern in tenant-scoped production endpoints.
   */
  markReplied(
    messageId: string,
    replyBody: string,
  ): Promise<{ businessId: string } | null>;
}
