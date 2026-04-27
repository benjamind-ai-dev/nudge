import type { Job } from "bullmq";
import type { QuickbooksWebhooksJobData } from "@nudge/shared";
import { QuickbooksWebhookSyncProcessor } from "./quickbooks-webhook-sync.processor";
import type { SyncSingleInvoiceUseCase } from "../../invoice-sync/application/sync-single-invoice.use-case";

const mkJob = (
  name: string,
  data: Partial<QuickbooksWebhooksJobData> = {},
): Job<QuickbooksWebhooksJobData> =>
  ({
    name,
    data: {
      connectionId: "conn-1",
      realmId: "realm-1",
      externalInvoiceId: "inv_1",
      eventId: "evt-1",
      operation: "updated",
      occurredAt: "2026-04-26T12:00:00Z",
      ...data,
    },
  }) as Job<QuickbooksWebhooksJobData>;

describe("QuickbooksWebhookSyncProcessor", () => {
  let useCase: jest.Mocked<Pick<SyncSingleInvoiceUseCase, "execute">>;
  let processor: QuickbooksWebhookSyncProcessor;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    processor = new QuickbooksWebhookSyncProcessor(
      useCase as unknown as SyncSingleInvoiceUseCase,
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
