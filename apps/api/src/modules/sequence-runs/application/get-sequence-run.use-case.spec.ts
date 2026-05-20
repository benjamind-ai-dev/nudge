import { GetSequenceRunUseCase } from "./get-sequence-run.use-case";
import type { SequenceRunRepository } from "../domain/sequence-run.repository";
import type { SequenceRunDetail } from "../domain/sequence-run.entity";
import { SequenceRunNotFoundError } from "../domain/sequence-run.errors";

const mkDetail = (over: Partial<SequenceRunDetail> = {}): SequenceRunDetail => ({
  id: "run-1",
  status: "active",
  pausedReason: null,
  stoppedReason: null,
  nextSendAt: new Date("2026-05-21T13:00:00Z"),
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
    contactName: "Jane",
    contactEmail: "jane@acme.example",
    contactPhone: null,
  },
  sequence: { id: "seq-1", name: "Friendly default", tierName: "Default" },
  steps: [
    { id: "step-1", stepOrder: 1, delayDays: 0, channel: "email", state: "completed" },
    { id: "step-2", stepOrder: 2, delayDays: 3, channel: "email", state: "current" },
    { id: "step-3", stepOrder: 3, delayDays: 7, channel: "email", state: "upcoming" },
  ],
  messages: [],
  ...over,
});

const createMockRepo = (
  overrides: Partial<SequenceRunRepository> = {},
): SequenceRunRepository => ({
  findManyByFilter: jest.fn(),
  findDetailById: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe("GetSequenceRunUseCase", () => {
  it("returns the run detail when found", async () => {
    const detail = mkDetail();
    const repo = createMockRepo({ findDetailById: jest.fn().mockResolvedValue(detail) });
    const useCase = new GetSequenceRunUseCase(repo);

    const result = await useCase.execute("run-1", "biz-1");

    expect(result).toEqual(detail);
    expect(repo.findDetailById).toHaveBeenCalledWith("run-1", "biz-1");
  });

  it("throws SequenceRunNotFoundError when the repo returns null", async () => {
    const repo = createMockRepo({ findDetailById: jest.fn().mockResolvedValue(null) });
    const useCase = new GetSequenceRunUseCase(repo);

    await expect(useCase.execute("missing", "biz-1")).rejects.toThrow(SequenceRunNotFoundError);
  });
});
