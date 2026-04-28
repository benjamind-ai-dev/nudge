import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { QuickbooksWebhookController } from "./quickbooks-webhook.controller";
import { ProcessQuickbooksWebhookUseCase } from "./application/process-quickbooks-webhook.use-case";
import { IntuitSignatureGuard } from "./infrastructure/intuit-signature.guard";

describe("QuickbooksWebhookController (HTTP plumbing)", () => {
  let app: INestApplication;
  let execute: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      controllers: [QuickbooksWebhookController],
      providers: [
        { provide: ProcessQuickbooksWebhookUseCase, useValue: { execute } },
      ],
    })
      // Bypass auth — guard logic is covered by intuit-signature.guard.spec.ts.
      .overrideGuard(IntuitSignatureGuard)
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
      .post("/v1/webhooks/quickbooks")
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
      .post("/v1/webhooks/quickbooks")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}))
      .expect(500);
  });
});
