import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { TwilioWebhookController } from "./twilio-webhook.controller";

describe("TwilioWebhookController", () => {
  let app: INestApplication;
  const webhookSecret = "test_secret_abc123";

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TwilioWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "TWILIO_WEBHOOK_SECRET") return webhookSecret;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
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
});
