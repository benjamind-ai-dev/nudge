import type { Queue } from "bullmq";
import type { QuickbooksWebhooksJobData } from "@nudge/shared";
import { ProcessQuickbooksWebhookUseCase } from "./process-quickbooks-webhook.use-case";
import type { ConnectionLookupByRealm } from "../domain/connection-lookup-by-realm.repository";

const REALM = "310687";

const evt = (over: Record<string, unknown> = {}) => ({
  specversion: "1.0",
  id: "evt-1",
  source: "intuit",
  type: "qbo.invoice.updated.v1",
  time: "2026-04-26T12:00:00Z",
  intuitentityid: "1234",
  intuitaccountid: REALM,
  ...over,
});

describe("ProcessQuickbooksWebhookUseCase", () => {
  let useCase: ProcessQuickbooksWebhookUseCase;
  let queueAdd: jest.Mock;
  let lookup: jest.Mocked<ConnectionLookupByRealm>;

  beforeEach(() => {
    queueAdd = jest.fn().mockResolvedValue(undefined);
    lookup = {
      findByRealm: jest.fn().mockResolvedValue({
        connectionId: "conn-1",
        businessId: "biz-1",
        status: "connected",
      }),
    };

    const queue = { add: queueAdd } as unknown as Queue<QuickbooksWebhooksJobData>;
    useCase = new ProcessQuickbooksWebhookUseCase(lookup, queue);
  });

  const run = (rawBody: Buffer) => useCase.execute({ rawBody });

  it("returns silently (no enqueue) when JSON body fails the CloudEvents schema", async () => {
    const body = Buffer.from(JSON.stringify({ eventNotifications: [] }));
    await expect(run(body)).resolves.toBeUndefined();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns silently (no enqueue) when raw body is not valid JSON", async () => {
    await expect(run(Buffer.from("not-json"))).resolves.toBeUndefined();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("enqueues 1 job with deterministic jobId for a valid Invoice event (batched mode)", async () => {
    const body = Buffer.from(JSON.stringify([evt()]));
    await run(body);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queueAdd.mock.calls[0];
    expect(name).toBe("sync-single-invoice");
    expect(data).toEqual({
      connectionId: "conn-1",
      realmId: REALM,
      externalInvoiceId: "1234",
      eventId: "evt-1",
      operation: "updated",
      occurredAt: "2026-04-26T12:00:00Z",
    });
    expect(opts.jobId).toBe("qb-wh-evt-1");
    expect(opts.attempts).toBe(5);
  });

  it("enqueues 1 job for a valid Invoice event sent in CloudEvents structured mode (single object)", async () => {
    const body = Buffer.from(JSON.stringify(evt()));
    await run(body);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [name, data] = queueAdd.mock.calls[0];
    expect(name).toBe("sync-single-invoice");
    expect(data).toMatchObject({
      connectionId: "conn-1",
      realmId: REALM,
      externalInvoiceId: "1234",
      operation: "updated",
    });
  });

  it("ignores non-invoice event types", async () => {
    const body = Buffer.from(
      JSON.stringify([evt({ id: "c-1", type: "qbo.customer.updated.v1" })]),
    );
    await run(body);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("skips event when no matching realmId connection", async () => {
    lookup.findByRealm.mockResolvedValueOnce(null);
    const body = Buffer.from(JSON.stringify([evt()]));
    await run(body);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("skips event when connection.status !== 'connected'", async () => {
    lookup.findByRealm.mockResolvedValueOnce({
      connectionId: "conn-1",
      businessId: "biz-1",
      status: "expired",
    });
    const body = Buffer.from(JSON.stringify([evt()]));
    await run(body);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("processes a 2-event batch and enqueues only the Invoice event", async () => {
    const body = Buffer.from(
      JSON.stringify([
        evt(),
        evt({ id: "c-1", type: "qbo.customer.updated.v1" }),
      ]),
    );
    await run(body);
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });
});
