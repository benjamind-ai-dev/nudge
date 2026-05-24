import { DeleteTemplateUseCase } from "./delete-template.use-case";
import { NotFoundException } from "@nestjs/common";
import type { TemplateRepository } from "../domain/template.repository";

function makeRepo(overrides: Partial<jest.Mocked<TemplateRepository>> = {}) {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    attachToCustomer: jest.fn(),
    detachFromCustomer: jest.fn(),
    ...overrides,
  } satisfies jest.Mocked<TemplateRepository>;
}

describe("DeleteTemplateUseCase", () => {
  it("returns when delete succeeds", async () => {
    const repo = makeRepo({ delete: jest.fn().mockResolvedValue(true) });
    const uc = new DeleteTemplateUseCase(repo);

    await expect(uc.execute({ id: "t1", businessId: "biz-1" })).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith("t1", "biz-1");
  });

  it("throws NotFoundException when the template is not in the business", async () => {
    const repo = makeRepo({ delete: jest.fn().mockResolvedValue(false) });
    const uc = new DeleteTemplateUseCase(repo);

    await expect(
      uc.execute({ id: "missing", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
