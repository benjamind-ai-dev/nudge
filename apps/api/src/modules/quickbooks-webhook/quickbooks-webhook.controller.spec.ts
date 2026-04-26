import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { createHmac } from "crypto";
import request from "supertest";
import { QuickbooksWebhookController } from "./quickbooks-webhook.controller";
import {
  CONNECTION_LOOKUP_BY_REALM,
  type ConnectionLookupByRealm,
} from "./domain/connection-lookup-by-realm.repository";
import {
  HmacIntuitSignatureVerifier,
  INTUIT_SIGNATURE_VERIFIER,
} from "./infrastructure/intuit-signature.verifier";

const TOKEN = "test-verifier-token";
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

const sign = (body: string) =>
  createHmac("sha256", TOKEN).update(Buffer.from(body)).digest("base64");

describe("QuickbooksWebhookController", () => {
  let app: INestApplication;
  let queueAdd: jest.Mock;
  let lookup: jest.Mocked<ConnectionLookupByRealm>;

  beforeEach(async () => {
    queueAdd = jest.fn().mockResolvedValue(undefined);
    lookup = {
      findByRealm: jest.fn().mockResolvedValue({
        connectionId: "conn-1",
        businessId: "biz-1",
        status: "connected",
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [QuickbooksWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === "QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN" ? TOKEN : undefined,
          },
        },
        {
          provide: INTUIT_SIGNATURE_VERIFIER,
          useFactory: () => new HmacIntuitSignatureVerifier(TOKEN),
        },
        { provide: CONNECTION_LOOKUP_BY_REALM, useValue: lookup },
        {
          provide: getQueueToken(QUEUE_NAMES.QUICKBOOKS_WEBHOOKS),
          useValue: { add: queueAdd },
        },
      ],
    }).compile();

    app = module.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 403 when intuit-signature header is missing", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .send(JSON.stringify([evt()]))
      .expect(403);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns 403 when signature is wrong", async () => {
    const body = JSON.stringify([evt()]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
      .send(body)
      .expect(403);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns 200 and enqueues 1 job for a valid Invoice event", async () => {
    const body = JSON.stringify([evt()]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);

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

  it("returns 200 and skips a Customer event (no enqueue)", async () => {
    const body = JSON.stringify([
      evt({ id: "c-1", type: "qbo.customer.updated.v1" }),
    ]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns 200 and skips an event with no matching realmId", async () => {
    lookup.findByRealm.mockResolvedValueOnce(null);
    const body = JSON.stringify([evt()]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns 200 and skips an event when connection.status is not 'connected'", async () => {
    lookup.findByRealm.mockResolvedValueOnce({
      connectionId: "conn-1",
      businessId: "biz-1",
      status: "expired",
    });
    const body = JSON.stringify([evt()]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("returns 200 (with warn log) when JSON body fails the CloudEvents schema", async () => {
    const body = JSON.stringify({ eventNotifications: [] });
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("enqueues 1 job from a 2-event payload (Invoice + Customer)", async () => {
    const body = JSON.stringify([
      evt(),
      evt({ id: "c-1", type: "qbo.customer.updated.v1" }),
    ]);
    await request(app.getHttpServer())
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .set("intuit-signature", sign(body))
      .send(body)
      .expect(200);
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });
});
