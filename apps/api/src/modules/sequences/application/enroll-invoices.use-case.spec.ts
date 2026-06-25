import { EnrollInvoicesUseCase } from "./enroll-invoices.use-case";
import {
  EnrollmentRepository,
  InvoiceEnrollContext,
} from "../domain/enrollment.repository";
import {
  SequenceNotFoundError,
  SequenceNotActiveError,
} from "../domain/sequence.errors";

const CHASEABLE = "overdue";

function makeRepo(over: Partial<EnrollmentRepository> = {}): jest.Mocked<EnrollmentRepository> {
  return {
    findEnrollTarget: jest.fn().mockResolvedValue({ isActive: true, firstStepId: "step-1", firstStepDelayDays: 0 }),
    getInvoiceContext: jest.fn(),
    findChaseableInvoiceIdsForCustomer: jest.fn(),
    moveAndCreateRun: jest.fn().mockResolvedValue({ moved: false, runId: "run-1" }),
    setCustomerSequenceOverride: jest.fn(),
    ...over,
  } as jest.Mocked<EnrollmentRepository>;
}

const ctx = (o: Partial<InvoiceEnrollContext>): InvoiceEnrollContext => ({
  invoiceId: "inv-1", status: CHASEABLE, dueDate: new Date("2026-01-01"),
  businessTimezone: "UTC", activeRunId: null, ...o,
});

it("throws SequenceNotFoundError when the sequence is not in the business", async () => {
  const repo = makeRepo({ findEnrollTarget: jest.fn().mockResolvedValue(null) });
  const uc = new EnrollInvoicesUseCase(repo);
  await expect(uc.execute("seq-x", "biz-1", ["inv-1"])).rejects.toThrow(SequenceNotFoundError);
});

it("throws SequenceNotActiveError when the sequence is inactive", async () => {
  const repo = makeRepo({ findEnrollTarget: jest.fn().mockResolvedValue({ isActive: false, firstStepId: "s", firstStepDelayDays: 0 }) });
  await expect(new EnrollInvoicesUseCase(repo).execute("seq-1", "biz-1", ["inv-1"])).rejects.toThrow(SequenceNotActiveError);
});

it("enrolls a chaseable invoice with no existing run", async () => {
  const repo = makeRepo({
    getInvoiceContext: jest.fn().mockResolvedValue(ctx({ activeRunId: null })),
    moveAndCreateRun: jest.fn().mockResolvedValue({ moved: false, runId: "run-1" }),
  });
  const res = await new EnrollInvoicesUseCase(repo).execute("seq-1", "biz-1", ["inv-1"]);
  expect(res).toMatchObject({ enrolled: 1, moved: 0, skipped: 0 });
  expect(res.items[0]).toMatchObject({ invoiceId: "inv-1", outcome: "enrolled", runId: "run-1" });
});

it("moves an invoice that already has an active run", async () => {
  const repo = makeRepo({
    getInvoiceContext: jest.fn().mockResolvedValue(ctx({ activeRunId: "old-run" })),
    moveAndCreateRun: jest.fn().mockResolvedValue({ moved: true, runId: "run-2" }),
  });
  const res = await new EnrollInvoicesUseCase(repo).execute("seq-1", "biz-1", ["inv-1"]);
  expect(res).toMatchObject({ enrolled: 0, moved: 1, skipped: 0 });
  expect(res.items[0].outcome).toBe("moved");
});

it("skips a non-chaseable invoice and a not-found invoice", async () => {
  const repo = makeRepo({
    getInvoiceContext: jest.fn()
      .mockResolvedValueOnce(ctx({ invoiceId: "paid-1", status: "paid" }))
      .mockResolvedValueOnce(null),
  });
  const res = await new EnrollInvoicesUseCase(repo).execute("seq-1", "biz-1", ["paid-1", "ghost"]);
  expect(res).toMatchObject({ enrolled: 0, moved: 0, skipped: 2 });
  expect(res.items.map((i) => i.outcome)).toEqual(["skipped_not_chaseable", "skipped_not_found"]);
  expect(repo.moveAndCreateRun).not.toHaveBeenCalled();
});
