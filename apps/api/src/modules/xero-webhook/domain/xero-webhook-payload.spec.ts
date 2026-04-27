import { xeroWebhookPayloadSchema } from "./xero-webhook-payload";

const validEvent = {
  resourceUrl:
    "https://api.xero.com/api.xro/2.0/Invoices/3d3a7-e8df-4ed8-9090-90c3a0bf9f38",
  resourceId: "3d3a7-e8df-4ed8-9090-90c3a0bf9f38",
  tenantId: "fbac3-cb29-4c2f-b8db-9f6a2b56fdc1",
  eventCategory: "INVOICE",
  eventType: "UPDATE",
  eventDateUtc: "2026-04-26T12:00:00.0000000",
};

const validPayload = {
  events: [validEvent],
  firstEventSequence: 1,
  lastEventSequence: 1,
};

describe("xeroWebhookPayloadSchema", () => {
  it("parses a payload with a single valid event", () => {
    const parsed = xeroWebhookPayloadSchema.parse(validPayload);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].resourceId).toBe(validEvent.resourceId);
    expect(parsed.events[0].tenantId).toBe(validEvent.tenantId);
    expect(parsed.firstEventSequence).toBe(1);
    expect(parsed.lastEventSequence).toBe(1);
  });

  it("parses a payload with multiple events", () => {
    const parsed = xeroWebhookPayloadSchema.parse({
      events: [
        validEvent,
        {
          ...validEvent,
          resourceId: "other-resource",
          eventType: "CREATE",
        },
      ],
      firstEventSequence: 1,
      lastEventSequence: 2,
    });
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[1].eventType).toBe("CREATE");
  });

  it("parses a payload with an empty events array (intent-to-receive ping)", () => {
    const parsed = xeroWebhookPayloadSchema.parse({
      events: [],
      firstEventSequence: 0,
      lastEventSequence: 0,
    });
    expect(parsed.events).toHaveLength(0);
  });

  it("parses an event without eventDateUtc (optional)", () => {
    const { eventDateUtc: _omit, ...without } = validEvent;
    void _omit;
    const parsed = xeroWebhookPayloadSchema.parse({
      ...validPayload,
      events: [without],
    });
    expect(parsed.events[0].eventDateUtc).toBeUndefined();
  });

  it("parses an event with eventDateUtc present", () => {
    const parsed = xeroWebhookPayloadSchema.parse(validPayload);
    expect(parsed.events[0].eventDateUtc).toBe(validEvent.eventDateUtc);
  });

  it("rejects an event missing tenantId", () => {
    const { tenantId: _omit, ...without } = validEvent;
    void _omit;
    expect(() =>
      xeroWebhookPayloadSchema.parse({
        ...validPayload,
        events: [without],
      }),
    ).toThrow();
  });

  it("rejects an event missing resourceId", () => {
    const { resourceId: _omit, ...without } = validEvent;
    void _omit;
    expect(() =>
      xeroWebhookPayloadSchema.parse({
        ...validPayload,
        events: [without],
      }),
    ).toThrow();
  });

  it("rejects an event missing eventCategory", () => {
    const { eventCategory: _omit, ...without } = validEvent;
    void _omit;
    expect(() =>
      xeroWebhookPayloadSchema.parse({
        ...validPayload,
        events: [without],
      }),
    ).toThrow();
  });

  it("rejects an event missing eventType", () => {
    const { eventType: _omit, ...without } = validEvent;
    void _omit;
    expect(() =>
      xeroWebhookPayloadSchema.parse({
        ...validPayload,
        events: [without],
      }),
    ).toThrow();
  });

  it("rejects an event with an invalid resourceUrl", () => {
    expect(() =>
      xeroWebhookPayloadSchema.parse({
        ...validPayload,
        events: [{ ...validEvent, resourceUrl: "not-a-url" }],
      }),
    ).toThrow();
  });
});
