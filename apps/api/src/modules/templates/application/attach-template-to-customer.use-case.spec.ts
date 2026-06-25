import { AttachTemplateToCustomerUseCase } from "./attach-template-to-customer.use-case";
import { NotFoundException } from "@nestjs/common";
import type { TemplateRepository, TemplateCustomerVerifier } from "../domain/template.repository";

const TPL = { id: "t1", businessId: "biz-1", name: "n", subject: null, body: "b", signature: null, createdAt: new Date(), updatedAt: new Date() };

function makeRepo(overrides: Partial<jest.Mocked<TemplateRepository>> = {}) {
  return {
    list: jest.fn(),
    findById: jest.fn().mockResolvedValue(TPL),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    isInUse: jest.fn(),
    attachToCustomer: jest.fn().mockResolvedValue(undefined),
    detachFromCustomer: jest.fn(),
    ...overrides,
  } satisfies jest.Mocked<TemplateRepository>;
}

function makeVerifier(exists = true): jest.Mocked<TemplateCustomerVerifier> {
  return { customerExistsInBusiness: jest.fn().mockResolvedValue(exists) };
}

describe("AttachTemplateToCustomerUseCase", () => {
  it("attaches when template and customer both exist in the business", async () => {
    const repo = makeRepo();
    const verifier = makeVerifier(true);
    const uc = new AttachTemplateToCustomerUseCase(repo, verifier);

    await uc.execute({ templateId: "t1", customerId: "c1", businessId: "biz-1" });

    expect(repo.attachToCustomer).toHaveBeenCalledWith("t1", "c1", "biz-1");
  });

  it("throws NotFoundException when template is not in the business", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const verifier = makeVerifier(true);
    const uc = new AttachTemplateToCustomerUseCase(repo, verifier);

    await expect(
      uc.execute({ templateId: "missing", customerId: "c1", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.attachToCustomer).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when customer is not in the business", async () => {
    const repo = makeRepo();
    const verifier = makeVerifier(false);
    const uc = new AttachTemplateToCustomerUseCase(repo, verifier);

    await expect(
      uc.execute({ templateId: "t1", customerId: "wrong", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.attachToCustomer).not.toHaveBeenCalled();
  });
});
