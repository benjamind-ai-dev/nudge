import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { XeroWebhookController } from "./xero-webhook.controller";
import { ProcessXeroWebhookUseCase } from "./application/process-xero-webhook.use-case";
import { XeroSignatureGuard } from "./infrastructure/xero-signature.guard";

describe("XeroWebhookController (HTTP plumbing)", () => {
  let app: INestApplication;
  let execute: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      controllers: [XeroWebhookController],
      providers: [
        { provide: ProcessXeroWebhookUseCase, useValue: { execute } },
      ],
    })
      .overrideGuard(XeroSignatureGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 and forwards rawBody to the use case", async () => {
    const body = JSON.stringify({ hello: "world" });
    await request(app.getHttpServer())
      .post("/v1/webhooks/xero")
      .set("Content-Type", "application/json")
      .send(body)
      .expect(200);

    expect(execute).toHaveBeenCalledTimes(1);
    const arg = execute.mock.calls[0][0];
    expect(Buffer.isBuffer(arg.rawBody)).toBe(true);
    expect(arg.rawBody.toString("utf8")).toBe(body);
  });

  it("propagates use-case errors as 500", async () => {
    execute.mockRejectedValueOnce(new Error("boom"));
    await request(app.getHttpServer())
      .post("/v1/webhooks/xero")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}))
      .expect(500);
  });
});
