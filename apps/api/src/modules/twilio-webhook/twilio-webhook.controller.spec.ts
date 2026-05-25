import { createHmac } from "crypto";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { TwilioWebhookController } from "./twilio-webhook.controller";
import { IngestTwilioInboundUseCase } from "./application/ingest-twilio-inbound.use-case";
import { TwilioSignatureGuard } from "./infrastructure/twilio-signature.guard";

const webhookSecret = "test_secret_abc123";
const twilioAuthToken = "test_auth_token_xyz789";
const INBOUND_PATH = "/v1/webhooks/twilio/inbound";

function signTwilio(url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", twilioAuthToken).update(data, "utf-8").digest("base64");
}

describe("TwilioWebhookController", () => {
  let app: INestApplication;
  const ingestInbound = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TwilioWebhookController],
      providers: [
        TwilioSignatureGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "TWILIO_WEBHOOK_SECRET") return webhookSecret;
              if (key === "TWILIO_AUTH_TOKEN") return twilioAuthToken;
              return undefined;
            }),
          },
        },
        { provide: IngestTwilioInboundUseCase, useValue: ingestInbound },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    ingestInbound.execute.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when secret is missing", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/twilio/status")
      .send({ MessageSid: "SM123", MessageStatus: "delivered" })
      .expect(401);
  });

  it("should return 401 when secret is wrong", async () => {
    await request(app.getHttpServer())
      .post("/v1/webhooks/twilio/status?secret=wrong_secret")
      .send({ MessageSid: "SM123", MessageStatus: "delivered" })
      .expect(401);
  });

  it("should return 200 on valid request with correct secret", async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/webhooks/twilio/status?secret=${webhookSecret}&businessId=biz_001&invoiceId=inv_001`,
      )
      .type("form")
      .send({
        MessageSid: "SM_abc123",
        MessageStatus: "delivered",
        To: "+15559876543",
      })
      .expect(200);
  });

  it("should return 200 for failed delivery status", async () => {
    await request(app.getHttpServer())
      .post(
        `/v1/webhooks/twilio/status?secret=${webhookSecret}&businessId=biz_002`,
      )
      .type("form")
      .send({
        MessageSid: "SM_def456",
        MessageStatus: "failed",
        To: "+15559876543",
        ErrorCode: "30007",
      })
      .expect(200);
  });

  describe("POST /v1/webhooks/twilio/inbound", () => {
    it("rejects when X-Twilio-Signature header is missing", async () => {
      await request(app.getHttpServer())
        .post(INBOUND_PATH)
        .type("form")
        .send({ MessageSid: "SM_in1", From: "+15551112222", Body: "hi" })
        .expect(403);
      expect(ingestInbound.execute).not.toHaveBeenCalled();
    });

    it("rejects when X-Twilio-Signature is invalid", async () => {
      await request(app.getHttpServer())
        .post(INBOUND_PATH)
        .type("form")
        .set("X-Twilio-Signature", "not-a-valid-signature")
        .send({ MessageSid: "SM_in2", From: "+15551112222", Body: "hi" })
        .expect(403);
      expect(ingestInbound.execute).not.toHaveBeenCalled();
    });

    it("accepts valid signature and enqueues an ingest job", async () => {
      const params = {
        MessageSid: "SM_in3",
        From: "+15551112222",
        To: "+15559998888",
        Body: "thanks, paid",
      };
      const server = app.getHttpServer();
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const host = `127.0.0.1:${port}`;
      const url = `http://${host}${INBOUND_PATH}`;
      const signature = signTwilio(url, params);

      await request(server)
        .post(INBOUND_PATH)
        .type("form")
        .set("Host", host)
        .set("X-Twilio-Signature", signature)
        .send(params)
        .expect(200);

      expect(ingestInbound.execute).toHaveBeenCalledWith({
        messageSid: "SM_in3",
        from: "+15551112222",
        to: "+15559998888",
        body: "thanks, paid",
      });
    });

    it("returns 200 and skips enqueue when MessageSid or From is missing", async () => {
      const params = { To: "+15559998888", Body: "orphan" };
      const server = app.getHttpServer();
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const host = `127.0.0.1:${port}`;
      const url = `http://${host}${INBOUND_PATH}`;
      const signature = signTwilio(url, params);

      await request(server)
        .post(INBOUND_PATH)
        .type("form")
        .set("Host", host)
        .set("X-Twilio-Signature", signature)
        .send(params)
        .expect(200);

      expect(ingestInbound.execute).not.toHaveBeenCalled();
    });
  });
});
