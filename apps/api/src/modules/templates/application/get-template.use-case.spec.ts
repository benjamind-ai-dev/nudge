import { GetTemplateUseCase } from "./get-template.use-case";
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

describe("GetTemplateUseCase", () => {
  it("returns the template when found", async () => {
    const tpl = { id: "t1", businessId: "biz-1", name: "A", subject: null, body: "b", signature: null, createdAt: new Date(), updatedAt: new Date() };
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(tpl) });
    const uc = new GetTemplateUseCase(repo);

    const result = await uc.execute({ id: "t1", businessId: "biz-1" });

    expect(repo.findById).toHaveBeenCalledWith("t1", "biz-1");
    expect(result).toEqual(tpl);
  });

  it("throws NotFoundException when the template does not exist for that business", async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetTemplateUseCase(repo);

    await expect(
      uc.execute({ id: "missing", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
