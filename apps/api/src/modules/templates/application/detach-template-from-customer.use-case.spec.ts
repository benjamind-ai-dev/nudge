import { DetachTemplateFromCustomerUseCase } from "./detach-template-from-customer.use-case";
import { NotFoundException } from "@nestjs/common";
import type { TemplateRepository } from "../domain/template.repository";

const TPL = { id: "t1", businessId: "biz-1", name: "n", subject: null, body: "b", signature: null, createdAt: new Date(), updatedAt: new Date() };

function makeRepo(overrides: Partial<jest.Mocked<TemplateRepository>> = {}) {
  return {
    list: jest.fn(),
    findById: jest.fn().mockResolvedValue(TPL),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    isInUse: jest.fn(),
    attachToCustomer: jest.fn(),
    detachFromCustomer: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies jest.Mocked<TemplateRepository>;
}

describe("DetachTemplateFromCustomerUseCase", () => {
  it("delegates to the repo when template exists", async () => {
    const repo = makeRepo();
    const uc = new DetachTemplateFromCustomerUseCase(repo);

    await uc.execute({ templateId: "t1", customerId: "c1", businessId: "biz-1" });

    expect(repo.detachFromCustomer).toHaveBeenCalledWith("t1", "c1", "biz-1");
  });

  it("throws NotFoundException when template is not in the business", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new DetachTemplateFromCustomerUseCase(repo);

    await expect(
      uc.execute({ templateId: "missing", customerId: "c1", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.detachFromCustomer).not.toHaveBeenCalled();
  });
});
