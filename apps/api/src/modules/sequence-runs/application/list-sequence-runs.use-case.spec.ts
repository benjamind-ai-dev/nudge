import { ListSequenceRunsUseCase } from "./list-sequence-runs.use-case";
import type {
  SequenceRunListFilter,
  SequenceRunListResult,
  SequenceRunRepository,
} from "../domain/sequence-run.repository";
import type { SequenceRunListItem } from "../domain/sequence-run.entity";

const mkItem = (over: Partial<SequenceRunListItem> = {}): SequenceRunListItem => ({
  id: "run-1",
  status: "active",
  pausedReason: null,
  stoppedReason: null,
  nextSendAt: new Date("2026-05-21T13:00:00Z"),
  startedAt: new Date("2026-05-15T09:00:00Z"),
  completedAt: null,
  invoice: { id: "inv-1", invoiceNumber: "INV-001", amountCents: 10_000, balanceDueCents: 10_000, status: "sent" },
  customer: { id: "cust-1", companyName: "Acme Corp" },
  currentStep: { stepOrder: 2, channel: "email" },
  ...over,
});

const createMockRepo = (
  overrides: Partial<SequenceRunRepository> = {},
): SequenceRunRepository => ({
  findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 0 } satisfies SequenceRunListResult),
  findDetailById: jest.fn(),
  findActionContext: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn(),
  ...overrides,
});

describe("ListSequenceRunsUseCase", () => {
  it("returns items and pagination metadata", async () => {
    const items = [mkItem(), mkItem({ id: "run-2" })];
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items, total: 42 }),
    });
    const useCase = new ListSequenceRunsUseCase(repo);

    const result = await useCase.execute({ businessId: "biz-1", page: 1, limit: 25 });

    expect(result.data).toEqual(items);
    expect(result.pagination).toEqual({ page: 1, limit: 25, total: 42, totalPages: 2 });
  });

  it("forwards filters to the repository unchanged", async () => {
    const repo = createMockRepo();
    const useCase = new ListSequenceRunsUseCase(repo);

    const filter: SequenceRunListFilter = {
      businessId: "biz-1",
      page: 2,
      limit: 10,
      status: "paused",
      customerId: "cust-1",
      invoiceId: "inv-1",
    };
    await useCase.execute(filter);

    expect(repo.findManyByFilter).toHaveBeenCalledWith(filter);
  });

  it("forwards sequenceId filter to the repository", async () => {
    const repo = createMockRepo();
    const useCase = new ListSequenceRunsUseCase(repo);

    const filter: SequenceRunListFilter = {
      businessId: "biz-1",
      page: 1,
      limit: 25,
      sequenceId: "seq-00000000-0000-0000-0000-000000000001",
    };
    await useCase.execute(filter);

    expect(repo.findManyByFilter).toHaveBeenCalledWith(filter);
  });

  it("computes totalPages = 1 when total is zero", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    });
    const useCase = new ListSequenceRunsUseCase(repo);

    const result = await useCase.execute({ businessId: "biz-1", page: 1, limit: 25 });

    expect(result.pagination.totalPages).toBe(1);
  });

  it("rounds totalPages up", async () => {
    const repo = createMockRepo({
      findManyByFilter: jest.fn().mockResolvedValue({ items: [], total: 26 }),
    });
    const useCase = new ListSequenceRunsUseCase(repo);

    const result = await useCase.execute({ businessId: "biz-1", page: 1, limit: 25 });

    expect(result.pagination.totalPages).toBe(2);
  });
});
