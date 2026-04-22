export const JOB_NAMES = {
  MESSAGE_SEND_TICK: "message-send-tick",
  SEND_MESSAGE: "send-message",
} as const;

export type MessageSendJobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
