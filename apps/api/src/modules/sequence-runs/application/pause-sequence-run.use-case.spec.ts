import { PauseSequenceRunUseCase } from "./pause-sequence-run.use-case";
import type {
  SequenceRunActionContext,
  SequenceRunRepository,
} from "../domain/sequence-run.repository";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "../domain/sequence-run.errors";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";

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
  status: "paused",
  pausedReason: "manual_pause",
  stoppedReason: null,
  nextSendAt: null,
  startedAt: new Date("2026-05-15T09:00:00Z"),
  completedAt: null,
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

describe("PauseSequenceRunUseCase", () => {
  it("pauses an active run and returns the updated detail", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "active" })),
      findDetailById: jest.fn().mockResolvedValue(mkDetail()),
    });
    const useCase = new PauseSequenceRunUseCase(repo);

    const result = await useCase.execute("run-1", "biz-1");

    expect(repo.pause).toHaveBeenCalledWith("run-1", "biz-1", "manual_pause");
    expect(result.status).toBe("paused");
    expect(result.pausedReason).toBe("manual_pause");
  });

  it("throws SequenceRunNotFoundError when context is not found", async () => {
    const repo = createMockRepo({ findActionContext: jest.fn().mockResolvedValue(null) });
    const useCase = new PauseSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(SequenceRunNotFoundError);
  });

  it("throws InvalidStatusTransitionError when run is not active", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "paused" })),
    });
    const useCase = new PauseSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(InvalidStatusTransitionError);
    expect(repo.pause).not.toHaveBeenCalled();
  });

  it("throws SequenceRunNotFoundError if the detail lookup after update returns null", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "active" })),
      findDetailById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new PauseSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(SequenceRunNotFoundError);
  });
});
