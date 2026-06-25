import { UpdateTemplateUseCase } from "./update-template.use-case";
import { NotFoundException } from "@nestjs/common";
import type { TemplateRepository } from "../domain/template.repository";

function makeRepo(overrides: Partial<jest.Mocked<TemplateRepository>> = {}) {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    isInUse: jest.fn(),
    attachToCustomer: jest.fn(),
    detachFromCustomer: jest.fn(),
    ...overrides,
  } satisfies jest.Mocked<TemplateRepository>;
}

describe("UpdateTemplateUseCase", () => {
  it("returns the updated template", async () => {
    const updated = { id: "t1", businessId: "biz-1", name: "Y", subject: null, body: "B2", signature: null, createdAt: new Date(), updatedAt: new Date() };
    const repo = makeRepo({ update: jest.fn().mockResolvedValue(updated) });
    const uc = new UpdateTemplateUseCase(repo);

    const result = await uc.execute({
      id: "t1",
      businessId: "biz-1",
      patch: { name: "Y", body: "B2" },
    });

    expect(repo.update).toHaveBeenCalledWith("t1", "biz-1", { name: "Y", body: "B2" });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundException when the template is not in the business", async () => {
    const repo = makeRepo({ update: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateTemplateUseCase(repo);

    await expect(
      uc.execute({ id: "missing", businessId: "biz-1", patch: { name: "Y" } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
