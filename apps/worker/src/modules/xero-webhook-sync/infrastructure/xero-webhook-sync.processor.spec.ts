import type { Job } from "bullmq";
import type { XeroWebhooksJobData } from "@nudge/shared";
import { XeroWebhookSyncProcessor } from "./xero-webhook-sync.processor";
import type { SyncSingleXeroInvoiceUseCase } from "../application/sync-single-xero-invoice.use-case";

const mkJob = (
  name: string,
  data: Partial<XeroWebhooksJobData> = {},
): Job<XeroWebhooksJobData> =>
  ({
    name,
    data: {
      connectionId: "conn-1",
      tenantId: "tenant-1",
      externalInvoiceId: "inv_1",
      eventCategory: "INVOICE",
      eventType: "UPDATE",
      occurredAt: "2026-04-26T12:00:00Z",
      ...data,
    },
  }) as Job<XeroWebhooksJobData>;

describe("XeroWebhookSyncProcessor", () => {
  let useCase: jest.Mocked<Pick<SyncSingleXeroInvoiceUseCase, "execute">>;
  let processor: XeroWebhookSyncProcessor;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    processor = new XeroWebhookSyncProcessor(
      useCase as unknown as SyncSingleXeroInvoiceUseCase,
    );
  });

  it("dispatches 'sync-single-invoice' to the use case with job.data", async () => {
    const job = mkJob("sync-single-invoice");
    await processor.process(job);
    expect(useCase.execute).toHaveBeenCalledWith(job.data);
  });

  it("ignores unknown job names without throwing", async () => {
    const job = mkJob("not-a-real-job");
    await expect(processor.process(job)).resolves.toBeUndefined();
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});
