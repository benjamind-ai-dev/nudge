import {
  cloudEventsPayloadSchema,
  parseInvoiceOperation,
} from "./cloudevents-payload";

const validEvent = {
  specversion: "1.0",
  id: "88cd52aa-33b6-4351-9aa4-47572edbd068",
  source: "intuit.dsnBgbseACLLRZNxo2dfc4evmEJdxde58xeeYcZliOU=",
  type: "qbo.invoice.updated.v1",
  datacontenttype: "application/json",
  time: "2025-09-10T21:31:25.179851517Z",
  intuitentityid: "1234",
  intuitaccountid: "310687",
  data: {},
};

describe("cloudEventsPayloadSchema", () => {
  describe("batched mode (array)", () => {
    it("parses a single valid event", () => {
      const parsed = cloudEventsPayloadSchema.parse([validEvent]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(validEvent.id);
    });

    it("parses multiple events from different realms", () => {
      const parsed = cloudEventsPayloadSchema.parse([
        validEvent,
        { ...validEvent, id: "other-id", intuitaccountid: "999" },
      ]);
      expect(parsed).toHaveLength(2);
      expect(parsed[1].intuitaccountid).toBe("999");
    });

    it("rejects empty array", () => {
      expect(() => cloudEventsPayloadSchema.parse([])).toThrow();
    });
  });

  describe("structured mode (single object) — Intuit's default for many events", () => {
    it("normalizes a single CloudEvent object into a 1-element array", () => {
      const parsed = cloudEventsPayloadSchema.parse(validEvent);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(validEvent.id);
      expect(parsed[0].type).toBe(validEvent.type);
    });

    it("rejects a single object that is not a CloudEvent", () => {
      expect(() =>
        cloudEventsPayloadSchema.parse({ eventNotifications: [] }),
      ).toThrow();
    });
  });

  describe("validation rules apply to both modes", () => {
    it("rejects events with specversion !== '1.0'", () => {
      expect(() =>
        cloudEventsPayloadSchema.parse([{ ...validEvent, specversion: "0.3" }]),
      ).toThrow();
      expect(() =>
        cloudEventsPayloadSchema.parse({ ...validEvent, specversion: "0.3" }),
      ).toThrow();
    });

    it("rejects events missing intuitaccountid", () => {
      const { intuitaccountid: _x, ...without } = validEvent;
      void _x;
      expect(() => cloudEventsPayloadSchema.parse([without])).toThrow();
      expect(() => cloudEventsPayloadSchema.parse(without)).toThrow();
    });

    it("rejects events missing intuitentityid", () => {
      const { intuitentityid: _x, ...without } = validEvent;
      void _x;
      expect(() => cloudEventsPayloadSchema.parse([without])).toThrow();
    });

    it("rejects events with non-RFC3339 time", () => {
      expect(() =>
        cloudEventsPayloadSchema.parse([{ ...validEvent, time: "yesterday" }]),
      ).toThrow();
    });
  });
});

describe("parseInvoiceOperation", () => {
  it("returns the verb for qbo.invoice.<verb>.v1", () => {
    expect(parseInvoiceOperation("qbo.invoice.updated.v1")).toBe("updated");
    expect(parseInvoiceOperation("qbo.invoice.created.v1")).toBe("created");
    expect(parseInvoiceOperation("qbo.invoice.deleted.v1")).toBe("deleted");
    expect(parseInvoiceOperation("qbo.invoice.voided.v1")).toBe("voided");
  });

  it("returns null for non-invoice types", () => {
    expect(parseInvoiceOperation("qbo.customer.updated.v1")).toBeNull();
    expect(parseInvoiceOperation("qbo.payment.created.v1")).toBeNull();
  });

  it("returns null for unrelated strings", () => {
    expect(parseInvoiceOperation("not.an.event")).toBeNull();
    expect(parseInvoiceOperation("")).toBeNull();
  });
});
