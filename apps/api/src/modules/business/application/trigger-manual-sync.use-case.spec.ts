import { TriggerManualSyncUseCase } from "./trigger-manual-sync.use-case";
import {
  BusinessNotFoundError,
  NoActiveConnectionError,
  SyncRateLimitedError,
} from "../domain/business.errors";

const BIZ_ID = "550e8400-e29b-41d4-a716-446655440000";

const business = {
  id: BIZ_ID,
  name: "Acme",
  accountingProvider: "quickbooks",
  senderName: "Acme",
  senderEmail: "billing@acme.com",
  emailSignature: null,
  timezone: "America/New_York",
  isActive: true,
  customerCount: 0,
  invoiceCount: 0,
  connections: [{ provider: "quickbooks", status: "connected", lastSyncAt: null }],
};

function makeDeps() {
  return {
    businessRepo: { findById: jest.fn() },
    connectionRepo: { findByBusinessAndProvider: jest.fn() },
    rateLimit: { tryAcquire: jest.fn() },
    queue: { add: jest.fn() },
  };
}

describe("TriggerManualSyncUseCase", () => {
  it("enqueues invoice-sync job with priority 1 and returns jobId", async () => {
    const d = makeDeps();
    d.businessRepo.findById.mockResolvedValue(business);
    d.connectionRepo.findByBusinessAndProvider.mockResolvedValue({
      id: "conn-123",
      status: "connected",
    });
    d.rateLimit.tryAcquire.mockResolvedValue({
      acquired: true,
      retryAfterSeconds: 0,
    });
    d.queue.add.mockResolvedValue({ id: "job-abc" });

    const uc = new TriggerManualSyncUseCase(
      d.businessRepo as never,
      d.connectionRepo as never,
      d.rateLimit as never,
      d.queue as never,
    );

    const out = await uc.execute(BIZ_ID);

    expect(out).toEqual({ message: "Sync queued", jobId: "job-abc" });
    expect(d.queue.add).toHaveBeenCalledWith(
      "invoice-sync",
      { connectionId: "conn-123" },
      { priority: 1 },
    );
    expect(d.connectionRepo.findByBusinessAndProvider).toHaveBeenCalledWith(
      BIZ_ID,
      "quickbooks",
    );
  });

  it("throws BusinessNotFoundError when business missing", async () => {
    const d = makeDeps();
    d.businessRepo.findById.mockResolvedValue(null);

    const uc = new TriggerManualSyncUseCase(
      d.businessRepo as never,
      d.connectionRepo as never,
      d.rateLimit as never,
      d.queue as never,
    );

    await expect(uc.execute(BIZ_ID)).rejects.toBeInstanceOf(
      BusinessNotFoundError,
    );
    expect(d.rateLimit.tryAcquire).not.toHaveBeenCalled();
    expect(d.queue.add).not.toHaveBeenCalled();
  });

  it("throws NoActiveConnectionError when no connection exists", async () => {
    const d = makeDeps();
    d.businessRepo.findById.mockResolvedValue(business);
    d.connectionRepo.findByBusinessAndProvider.mockResolvedValue(null);

    const uc = new TriggerManualSyncUseCase(
      d.businessRepo as never,
      d.connectionRepo as never,
      d.rateLimit as never,
      d.queue as never,
    );

    await expect(uc.execute(BIZ_ID)).rejects.toBeInstanceOf(
      NoActiveConnectionError,
    );
    expect(d.rateLimit.tryAcquire).not.toHaveBeenCalled();
    expect(d.queue.add).not.toHaveBeenCalled();
  });

  it("throws SyncRateLimitedError carrying retryAfterSeconds when rate-limited", async () => {
    const d = makeDeps();
    d.businessRepo.findById.mockResolvedValue(business);
    d.connectionRepo.findByBusinessAndProvider.mockResolvedValue({
      id: "conn-123",
      status: "connected",
    });
    d.rateLimit.tryAcquire.mockResolvedValue({
      acquired: false,
      retryAfterSeconds: 200,
    });

    const uc = new TriggerManualSyncUseCase(
      d.businessRepo as never,
      d.connectionRepo as never,
      d.rateLimit as never,
      d.queue as never,
    );

    const promise = uc.execute(BIZ_ID);
    await expect(promise).rejects.toBeInstanceOf(SyncRateLimitedError);
    await expect(promise).rejects.toMatchObject({
      retryAfterSeconds: 200,
    });
    expect(d.queue.add).not.toHaveBeenCalled();
  });
});
