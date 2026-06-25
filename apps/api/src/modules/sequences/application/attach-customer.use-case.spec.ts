import { EnrollmentRepository } from "../domain/enrollment.repository";
import { EnrollInvoicesUseCase } from "./enroll-invoices.use-case";
import { AttachCustomerUseCase } from "./attach-customer.use-case";

function makeRepo(overrides: Partial<EnrollmentRepository> = {}): EnrollmentRepository {
  return {
    findEnrollTarget: jest.fn(),
    getInvoiceContext: jest.fn(),
    findChaseableInvoiceIdsForCustomer: jest.fn().mockResolvedValue([]),
    moveAndCreateRun: jest.fn(),
    setCustomerSequenceOverride: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("AttachCustomerUseCase", () => {
  it("throws CustomerNotInBusinessError when setCustomerSequenceOverride returns false", async () => {
    const repo = makeRepo({ setCustomerSequenceOverride: jest.fn().mockResolvedValue(false) });
    const enroll = { execute: jest.fn() } as unknown as EnrollInvoicesUseCase;
    await expect(new AttachCustomerUseCase(repo, enroll).execute("seq-1", "biz-1", "cust-x"))
      .rejects.toThrow(); // CustomerNotInBusinessError
  });

  it("sets override and enrolls the customer's chaseable invoices", async () => {
    const repo = makeRepo({
      setCustomerSequenceOverride: jest.fn().mockResolvedValue(true),
      findChaseableInvoiceIdsForCustomer: jest.fn().mockResolvedValue(["inv-1", "inv-2"]),
    });
    const enroll = { execute: jest.fn().mockResolvedValue({ enrolled: 2, moved: 0, skipped: 0, items: [] }) } as unknown as EnrollInvoicesUseCase;
    const res = await new AttachCustomerUseCase(repo, enroll).execute("seq-1", "biz-1", "cust-1");
    expect(repo.setCustomerSequenceOverride).toHaveBeenCalledWith("cust-1", "biz-1", "seq-1");
    expect(enroll.execute).toHaveBeenCalledWith("seq-1", "biz-1", ["inv-1", "inv-2"]);
    expect(res).toMatchObject({ customerId: "cust-1", overrideSet: true, enrollment: { enrolled: 2 } });
  });
});
