import { RecalculateDaysOverdueUseCase } from "./recalculate-days-overdue.use-case";
import type {
  DaysRecalcRepository,
  TransitionedInvoice,
} from "../domain/days-recalc.repository";

const createMockRepo = (
  overrides: Partial<DaysRecalcRepository> = {},
): DaysRecalcRepository => ({
  recalculate: jest.fn().mockResolvedValue({ updatedCount: 0, transitioned: [] }),
  findInvoicesWithoutActiveSequenceRun: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe("RecalculateDaysOverdueUseCase", () => {
  it("returns zero counts when no rows are matched", async () => {
    const repo = createMockRepo();

    const useCase = new RecalculateDaysOverdueUseCase(repo);
    const result = await useCase.execute();

    expect(result).toEqual({
      updatedCount: 0,
      transitionedCount: 0,
      transitionedWithoutSequenceCount: 0,
    });
    expect(repo.findInvoicesWithoutActiveSequenceRun).not.toHaveBeenCalled();
  });

  it("returns updatedCount when rows updated but none transitioned", async () => {
    const repo = createMockRepo({
      recalculate: jest.fn().mockResolvedValue({ updatedCount: 4823, transitioned: [] }),
    });

    const useCase = new RecalculateDaysOverdueUseCase(repo);
    const result = await useCase.execute();

    expect(result).toEqual({
      updatedCount: 4823,
      transitionedCount: 0,
      transitionedWithoutSequenceCount: 0,
    });
    expect(repo.findInvoicesWithoutActiveSequenceRun).not.toHaveBeenCalled();
  });

  it("checks sequence runs only for transitioned invoices", async () => {
    const transitioned: TransitionedInvoice[] = [
      { invoiceId: "inv-1", invoiceNumber: "INV-001" },
      { invoiceId: "inv-2", invoiceNumber: "INV-002" },
    ];

    const repo = createMockRepo({
      recalculate: jest.fn().mockResolvedValue({ updatedCount: 100, transitioned }),
      findInvoicesWithoutActiveSequenceRun: jest.fn().mockResolvedValue([]),
    });

    const useCase = new RecalculateDaysOverdueUseCase(repo);
    const result = await useCase.execute();

    expect(repo.findInvoicesWithoutActiveSequenceRun).toHaveBeenCalledWith([
      "inv-1",
      "inv-2",
    ]);
    expect(result).toEqual({
      updatedCount: 100,
      transitionedCount: 2,
      transitionedWithoutSequenceCount: 0,
    });
  });

  it("counts transitioned invoices without active sequence runs", async () => {
    const transitioned: TransitionedInvoice[] = [
      { invoiceId: "inv-1", invoiceNumber: "INV-001" },
      { invoiceId: "inv-2", invoiceNumber: "INV-002" },
      { invoiceId: "inv-3", invoiceNumber: "INV-003" },
    ];
    const withoutSequence: TransitionedInvoice[] = [
      { invoiceId: "inv-2", invoiceNumber: "INV-002" },
      { invoiceId: "inv-3", invoiceNumber: "INV-003" },
    ];

    const repo = createMockRepo({
      recalculate: jest.fn().mockResolvedValue({ updatedCount: 50, transitioned }),
      findInvoicesWithoutActiveSequenceRun: jest.fn().mockResolvedValue(withoutSequence),
    });

    const useCase = new RecalculateDaysOverdueUseCase(repo);
    const result = await useCase.execute();

    expect(result).toEqual({
      updatedCount: 50,
      transitionedCount: 3,
      transitionedWithoutSequenceCount: 2,
    });
  });

  it("caps logged invoice numbers at 10 even when many transition", async () => {
    const transitioned: TransitionedInvoice[] = Array.from({ length: 25 }, (_, i) => ({
      invoiceId: `inv-${i}`,
      invoiceNumber: `INV-${String(i).padStart(3, "0")}`,
    }));

    const repo = createMockRepo({
      recalculate: jest.fn().mockResolvedValue({ updatedCount: 25, transitioned }),
      findInvoicesWithoutActiveSequenceRun: jest.fn().mockResolvedValue(transitioned),
    });

    const useCase = new RecalculateDaysOverdueUseCase(repo);

    const logSpy = jest
      .spyOn(useCase["logger"], "log")
      .mockImplementation(() => undefined);

    await useCase.execute();

    const transitionLog = logSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        (call[0] as { event?: string }).event === "days_recalc_transitioned_without_sequence",
    );
    expect(transitionLog).toBeDefined();
    expect(
      (transitionLog?.[0] as { sampleInvoiceNumbers: string[] }).sampleInvoiceNumbers,
    ).toHaveLength(10);
  });
});
