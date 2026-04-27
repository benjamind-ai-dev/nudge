import type { Queue } from "bullmq";
import type { XeroWebhooksJobData } from "@nudge/shared";
import { ProcessXeroWebhookUseCase } from "./process-xero-webhook.use-case";
import type { XeroConnectionLookup } from "../domain/xero-connection-lookup.repository";

const TENANT = "fbac3-cb29-4c2f-b8db-9f6a2b56fdc1";

const evt = (over: Record<string, unknown> = {}) => ({
  resourceUrl:
    "https://api.xero.com/api.xro/2.0/Invoices/3d3a7-e8df-4ed8-9090-90c3a0bf9f38",
  resourceId: "3d3a7-e8df-4ed8-9090-90c3a0bf9f38",
  tenantId: TENANT,
  eventCategory: "INVOICE",
  eventType: "UPDATE",
  eventDateUtc: "2026-04-26T12:00:00.0000000",
  ...over,
});

const payload = (events: ReturnType<typeof evt>[]) =>
  Buffer.from(
    JSON.stringify({
      events,
      firstEventSequence: 1,
      lastEventSequence: events.length,
    }),
  );

describe("ProcessXeroWebhookUseCase", () => {
  let useCase: ProcessXeroWebhookUseCase;
  let queueAdd: jest.Mock;
  let lookup: jest.Mocked<XeroConnectionLookup>;

  beforeEach(() => {
    queueAdd = jest.fn().mockResolvedValue(undefined);
    lookup = {
      findByTenantId: jest.fn().mockResolvedValue({
        connectionId: "conn-1",
        businessId: "biz-1",
        status: "connected",
      }),
    };

    const queue = { add: queueAdd } as unknown as Queue<XeroWebhooksJobData>;
    useCase = new ProcessXeroWebhookUseCase(lookup, queue);
  });

  const run = (rawBody: Buffer) => useCase.execute({ rawBody });

  it("returns silently (no enqueue) when raw body is not valid JSON", async () => {
    await expect(run(Buffer.from("not-json"))).resolves.toBeUndefined();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns silently (no enqueue) when JSON body fails the schema", async () => {
    const body = Buffer.from(JSON.stringify({ eventNotifications: [] }));
    await expect(run(body)).resolves.toBeUndefined();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("enqueues 1 job with deterministic jobId for a valid INVOICE.UPDATE event", async () => {
    await run(payload([evt()]));

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queueAdd.mock.calls[0];
    expect(name).toBe("sync-single-invoice");
    expect(data).toEqual({
      connectionId: "conn-1",
      tenantId: TENANT,
      externalInvoiceId: "3d3a7-e8df-4ed8-9090-90c3a0bf9f38",
      eventCategory: "INVOICE",
      eventType: "UPDATE",
      occurredAt: "2026-04-26T12:00:00.0000000",
    });
    expect(typeof opts.jobId).toBe("string");
    expect(opts.jobId.startsWith("xero-wh-")).toBe(true);
    expect(opts.jobId).toContain(TENANT);
    expect(opts.jobId).toContain("3d3a7-e8df-4ed8-9090-90c3a0bf9f38");
    expect(opts.jobId).toContain("UPDATE");
    expect(opts.attempts).toBe(5);
  });

  it("enqueues 1 job for a valid INVOICE.CREATE event", async () => {
    await run(payload([evt({ eventType: "CREATE" })]));

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [, data] = queueAdd.mock.calls[0];
    expect(data).toMatchObject({
      eventCategory: "INVOICE",
      eventType: "CREATE",
    });
  });

  it("ignores non-INVOICE event categories (CONTACT)", async () => {
    await run(payload([evt({ eventCategory: "CONTACT" })]));
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("ignores non-INVOICE event categories (PAYMENT)", async () => {
    await run(payload([evt({ eventCategory: "PAYMENT" })]));
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("ignores INVOICE events with unknown eventType", async () => {
    await run(payload([evt({ eventType: "DELETE" })]));
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("skips event when no matching tenantId connection", async () => {
    lookup.findByTenantId.mockResolvedValueOnce(null);
    await run(payload([evt()]));
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("skips event when connection.status !== 'connected'", async () => {
    lookup.findByTenantId.mockResolvedValueOnce({
      connectionId: "conn-1",
      businessId: "biz-1",
      status: "expired",
    });
    await run(payload([evt()]));
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("processes a 2-event batch and enqueues only the INVOICE event", async () => {
    await run(
      payload([
        evt(),
        evt({ resourceId: "other", eventCategory: "CONTACT" }),
      ]),
    );
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue and does not throw for an empty events array (intent-to-receive)", async () => {
    await expect(run(payload([]))).resolves.toBeUndefined();
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
