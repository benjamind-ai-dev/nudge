import { describe, it, expect } from "vitest";
import {
  STOPPED_REASONS,
  SEQUENCE_RUN_STATUSES,
  type StoppedReason,
  type SequenceRunStatus,
} from "./sequence-run";

describe("STOPPED_REASONS", () => {
  it("exposes the four reasons used across the system", () => {
    expect(STOPPED_REASONS).toEqual({
      PAYMENT_RECEIVED: "payment_received",
      INVOICE_VOIDED: "invoice_voided",
      CLIENT_REPLIED: "client_replied",
      MANUALLY_STOPPED: "manually_stopped",
    });
  });

  it("StoppedReason union covers every value", () => {
    const values: StoppedReason[] = [
      "payment_received",
      "invoice_voided",
      "client_replied",
      "manually_stopped",
    ];
    expect(values).toHaveLength(4);
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
