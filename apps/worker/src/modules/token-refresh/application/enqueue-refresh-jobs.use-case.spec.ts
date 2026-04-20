import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import {
  CONNECTION_REPOSITORY,
  ConnectionRepository,
} from "@nudge/connections-domain";
import { EnqueueRefreshJobsUseCase } from "./enqueue-refresh-jobs.use-case";

const BUFFER_MS = 15 * 60_000;

describe("EnqueueRefreshJobsUseCase", () => {
  let mockQueue: { add: jest.Mock };
  let repo: jest.Mocked<ConnectionRepository>;

  beforeEach(() => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    repo = {
      upsertByBusinessAndProvider: jest.fn(),
      findByBusinessAndProvider: jest.fn(),
      findById: jest.fn(),
      findDueForRefresh: jest.fn(),
      updateStatus: jest.fn(),
      refreshConnection: jest.fn(),
    } as unknown as jest.Mocked<ConnectionRepository>;
  });

  async function build() {
    const module = await Test.createTestingModule({
      providers: [
        EnqueueRefreshJobsUseCase,
        { provide: CONNECTION_REPOSITORY, useValue: repo },
        { provide: getQueueToken(QUEUE_NAMES.TOKEN_REFRESH), useValue: mockQueue },
      ],
    }).compile();
    return module.get(EnqueueRefreshJobsUseCase);
  }

  it("enqueues one job per due connection with correct options", async () => {
    repo.findDueForRefresh.mockResolvedValue([
      { id: "c-1", businessId: "b-1" } as any,
      { id: "c-2", businessId: "b-2" } as any,
    ]);
    const useCase = await build();
    await useCase.execute();

    expect(repo.findDueForRefresh).toHaveBeenCalledWith(expect.any(Date));
    const cutoff = repo.findDueForRefresh.mock.calls[0][0];
    expect(cutoff.getTime() - Date.now()).toBeGreaterThan(BUFFER_MS - 1000);
    expect(cutoff.getTime() - Date.now()).toBeLessThan(BUFFER_MS + 1000);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add).toHaveBeenCalledWith(
      "refresh-connection",
      { connectionId: "c-1", businessId: "b-1" },
      expect.objectContaining({
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      "refresh-connection",
      { connectionId: "c-2", businessId: "b-2" },
      expect.objectContaining({
        attempts: 5,
      }),
    );
    const addCalls = mockQueue.add.mock.calls;
    expect(addCalls[0][2]).not.toHaveProperty("jobId");
    expect(addCalls[1][2]).not.toHaveProperty("jobId");
  });

  it("enqueues nothing when no connections are due", async () => {
    repo.findDueForRefresh.mockResolvedValue([]);
    const useCase = await build();
    await useCase.execute();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
