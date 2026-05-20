import { StopSequenceRunUseCase } from "./stop-sequence-run.use-case";
import type {
  SequenceRunActionContext,
  SequenceRunRepository,
} from "../domain/sequence-run.repository";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "../domain/sequence-run.errors";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";

const NOW = new Date("2026-05-20T14:00:00Z");

const mkContext = (
  over: Partial<SequenceRunActionContext> = {},
): SequenceRunActionContext => ({
  id: "run-1",
  status: "active",
  invoice: { invoiceNumber: "INV-001", businessTimezone: "America/New_York" },
  customer: { companyName: "Acme Corp" },
  ...over,
});

const mkDetail = (over: Partial<SequenceRunDetail> = {}): SequenceRunDetail => ({
  id: "run-1",
  status: "stopped",
  pausedReason: null,
  stoppedReason: "manual_stop",
  nextSendAt: null,
  startedAt: new Date("2026-05-15T09:00:00Z"),
  completedAt: NOW,
  invoice: {
    id: "inv-1",
    invoiceNumber: "INV-001",
    amountCents: 10_000,
    amountPaidCents: 0,
    balanceDueCents: 10_000,
    currency: "USD",
    dueDate: new Date("2026-05-01"),
    status: "overdue",
  },
  customer: {
    id: "cust-1",
    companyName: "Acme Corp",
    contactName: null,
    contactEmail: "c@example.com",
    contactPhone: null,
  },
  sequence: { id: "seq-1", name: "Default", tierName: "Default" },
  steps: [],
  messages: [],
  ...over,
});

const createMockRepo = (
  overrides: Partial<SequenceRunRepository> = {},
): SequenceRunRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn(),
  findActionContext: jest.fn().mockResolvedValue(null),
  pause: jest.fn().mockResolvedValue(true),
  resume: jest.fn().mockResolvedValue(true),
  stop: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("StopSequenceRunUseCase", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it("stops an active run with manual_stop reason", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "active" })),
      findDetailById: jest.fn().mockResolvedValue(mkDetail()),
    });
    const useCase = new StopSequenceRunUseCase(repo);

    const result = await useCase.execute("run-1", "biz-1");

    expect(repo.stop).toHaveBeenCalledWith("run-1", "biz-1", "manual_stop", NOW);
    expect(result.status).toBe("stopped");
  });

  it("stops a paused run", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "paused" })),
      findDetailById: jest.fn().mockResolvedValue(mkDetail()),
    });
    const useCase = new StopSequenceRunUseCase(repo);

    await useCase.execute("run-1", "biz-1");

    expect(repo.stop).toHaveBeenCalledWith("run-1", "biz-1", "manual_stop", NOW);
  });

  it("throws InvalidStatusTransitionError when run is completed", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "completed" })),
    });
    const useCase = new StopSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(InvalidStatusTransitionError);
    expect(repo.stop).not.toHaveBeenCalled();
  });

  it("throws InvalidStatusTransitionError when run is already stopped", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "stopped" })),
    });
    const useCase = new StopSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(InvalidStatusTransitionError);
  });

  it("throws SequenceRunNotFoundError when context is not found", async () => {
    const repo = createMockRepo({ findActionContext: jest.fn().mockResolvedValue(null) });
    const useCase = new StopSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(SequenceRunNotFoundError);
  });
});
