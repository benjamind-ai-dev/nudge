import { DeleteTemplateUseCase } from "./delete-template.use-case";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { TemplateRepository } from "../domain/template.repository";

function makeRepo(overrides: Partial<jest.Mocked<TemplateRepository>> = {}) {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    isInUse: jest.fn().mockResolvedValue(false),
    attachToCustomer: jest.fn(),
    detachFromCustomer: jest.fn(),
    ...overrides,
  } satisfies jest.Mocked<TemplateRepository>;
}

describe("DeleteTemplateUseCase", () => {
  it("deletes when template is not in use", async () => {
    const repo = makeRepo({
      isInUse: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue(true),
    });
    const uc = new DeleteTemplateUseCase(repo);

    await expect(uc.execute({ id: "t1", businessId: "biz-1" })).resolves.toBeUndefined();
    expect(repo.isInUse).toHaveBeenCalledWith("t1", "biz-1");
    expect(repo.delete).toHaveBeenCalledWith("t1", "biz-1");
  });

  it("throws ConflictException and does NOT call delete when template is in use", async () => {
    const repo = makeRepo({
      isInUse: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
    });
    const uc = new DeleteTemplateUseCase(repo);

    await expect(
      uc.execute({ id: "t1", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the template is not in the business", async () => {
    const repo = makeRepo({
      isInUse: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue(false),
    });
    const uc = new DeleteTemplateUseCase(repo);

    await expect(
      uc.execute({ id: "missing", businessId: "biz-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
