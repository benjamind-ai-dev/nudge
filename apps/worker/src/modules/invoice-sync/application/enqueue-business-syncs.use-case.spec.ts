import type { Queue } from "bullmq";
import type { Connection, ProviderName } from "@nudge/connections-domain";
import { EnqueueBusinessSyncsUseCase } from "./enqueue-business-syncs.use-case";
import type { SyncConnectionReader } from "../domain/repositories";
import type {
  InvoiceSyncProvider,
  InvoiceSyncProviderMap,
} from "../domain/invoice-sync.provider";

const conn = (id: string, provider: ProviderName, businessId: string): Connection =>
  ({ id, provider, businessId } as unknown as Connection);

describe("EnqueueBusinessSyncsUseCase", () => {
  let reader: jest.Mocked<SyncConnectionReader>;
  let queue: jest.Mocked<Queue>;
  let providers: InvoiceSyncProviderMap;
  let useCase: EnqueueBusinessSyncsUseCase;

  beforeEach(() => {
    reader = {
      findAllSyncable: jest.fn(),
      findById: jest.fn(),
      findLatestConnectedByBusiness: jest.fn(),
      updateSyncCursor: jest.fn(),
    } as unknown as jest.Mocked<SyncConnectionReader>;
    queue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<Queue>;
    providers = {
      quickbooks: { name: "quickbooks", fetchPage: jest.fn() } as unknown as InvoiceSyncProvider,
    };
    useCase = new EnqueueBusinessSyncsUseCase(reader, queue, providers);
  });

  it("enqueues one 'invoice-sync' child per eligible business with correct jobId and options", async () => {
    reader.findAllSyncable.mockResolvedValue([
      conn("conn-1", "quickbooks", "biz-1"),
      conn("conn-2", "quickbooks", "biz-2"),
    ]);

    await useCase.execute();

    expect(reader.findAllSyncable).toHaveBeenCalledWith(["quickbooks"]);
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenNthCalledWith(
      1,
      "invoice-sync",
      { businessId: "biz-1" },
      expect.objectContaining({
        jobId: "sync-biz-1",
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      }),
    );
    expect(queue.add).toHaveBeenNthCalledWith(
      2,
      "invoice-sync",
      { businessId: "biz-2" },
      expect.objectContaining({ jobId: "sync-biz-2" }),
    );
  });

  it("passes only registered provider names to findAllSyncable", async () => {
    reader.findAllSyncable.mockResolvedValue([]);
    await useCase.execute();
    expect(reader.findAllSyncable).toHaveBeenCalledWith(["quickbooks"]);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("does nothing when no businesses are eligible", async () => {
    reader.findAllSyncable.mockResolvedValue([]);
    await useCase.execute();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
