import { ResumeSequenceRunUseCase } from "./resume-sequence-run.use-case";
import type {
  SequenceRunActionContext,
  SequenceRunRepository,
} from "../domain/sequence-run.repository";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "../domain/sequence-run.errors";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";

const FROZEN_NOW = new Date("2026-05-20T14:00:00Z"); // Wed 10:00 New_York → already in business hours

const mkContext = (
  over: Partial<SequenceRunActionContext> = {},
): SequenceRunActionContext => ({
  id: "run-1",
  status: "paused",
  invoice: { invoiceNumber: "INV-001", businessTimezone: "America/New_York" },
  customer: { companyName: "Acme Corp" },
  ...over,
});

const mkDetail = (over: Partial<SequenceRunDetail> = {}): SequenceRunDetail => ({
  id: "run-1",
  status: "active",
  pausedReason: null,
  stoppedReason: null,
  nextSendAt: new Date("2026-05-20T15:00:00Z"),
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

describe("ResumeSequenceRunUseCase", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it("resumes a paused run and sets next_send_at to ~now+1h adjusted to business hours", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "paused" })),
      findDetailById: jest.fn().mockResolvedValue(mkDetail()),
    });
    const useCase = new ResumeSequenceRunUseCase(repo);

    await useCase.execute("run-1", "biz-1");

    expect(repo.resume).toHaveBeenCalledTimes(1);
    const [calledId, calledBiz, calledNextSendAt] = (repo.resume as jest.Mock).mock.calls[0];
    expect(calledId).toBe("run-1");
    expect(calledBiz).toBe("biz-1");
    // FROZEN_NOW (Wed 10:00 NYC) + 1h = Wed 11:00 NYC → within business hours,
    // so nextBusinessHour returns it unchanged.
    expect((calledNextSendAt as Date).toISOString()).toBe("2026-05-20T15:00:00.000Z");
  });

  it("throws SequenceRunNotFoundError when context is not found", async () => {
    const repo = createMockRepo({ findActionContext: jest.fn().mockResolvedValue(null) });
    const useCase = new ResumeSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(SequenceRunNotFoundError);
  });

  it("throws InvalidStatusTransitionError when run is not paused", async () => {
    const repo = createMockRepo({
      findActionContext: jest.fn().mockResolvedValue(mkContext({ status: "active" })),
    });
    const useCase = new ResumeSequenceRunUseCase(repo);

    await expect(useCase.execute("run-1", "biz-1")).rejects.toThrow(InvalidStatusTransitionError);
    expect(repo.resume).not.toHaveBeenCalled();
  });
});
