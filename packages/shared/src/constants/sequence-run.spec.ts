import { describe, it, expect } from "vitest";
import {
  STOPPED_REASONS,
  PAUSED_REASONS,
  SEQUENCE_RUN_STATUSES,
  type StoppedReason,
  type SequenceRunStatus,
} from "./sequence-run";

describe("STOPPED_REASONS", () => {
  it("exposes all reasons used across the system", () => {
    expect(STOPPED_REASONS).toEqual({
      PAYMENT_RECEIVED: "payment_received",
      INVOICE_VOIDED: "invoice_voided",
      CLIENT_REPLIED: "client_replied",
      MANUALLY_STOPPED: "manual_stop",
      SUBSCRIPTION_CANCELLED: "subscription_cancelled",
      EMAIL_BOUNCED: "email_bounced",
      REASSIGNED: "reassigned",
    });
  });

  it("exposes the reassigned stopped reason", () => {
    expect(STOPPED_REASONS.REASSIGNED).toBe("reassigned");
  });

  it("StoppedReason union covers every value", () => {
    const values: StoppedReason[] = [
      "payment_received",
      "invoice_voided",
      "client_replied",
      "manual_stop",
      "subscription_cancelled",
      "email_bounced",
      "reassigned",
    ];
    expect(values).toHaveLength(7);
  });
});

describe("PAUSED_REASONS", () => {
  it("SEQUENCE_PAUSED equals sequence_paused", () => {
    expect(PAUSED_REASONS.SEQUENCE_PAUSED).toBe("sequence_paused");
  });
});

describe("SEQUENCE_RUN_STATUSES", () => {
  it("exposes the four lifecycle states", () => {
    expect(SEQUENCE_RUN_STATUSES).toEqual({
      ACTIVE: "active",
      PAUSED: "paused",
      STOPPED: "stopped",
      COMPLETED: "completed",
    });
  });

  it("SequenceRunStatus union covers every value", () => {
    const values: SequenceRunStatus[] = ["active", "paused", "stopped", "completed"];
    expect(values).toHaveLength(4);
  });
});
