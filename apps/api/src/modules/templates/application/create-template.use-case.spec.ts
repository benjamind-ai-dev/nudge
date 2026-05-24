import { CreateTemplateUseCase } from "./create-template.use-case";
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

describe("CreateTemplateUseCase", () => {
  it("delegates to the repo and returns the created template", async () => {
    const created = { id: "t1", businessId: "biz-1", name: "X", subject: "S", body: "B", signature: null, createdAt: new Date(), updatedAt: new Date() };
    const repo = makeRepo({ create: jest.fn().mockResolvedValue(created) });
    const uc = new CreateTemplateUseCase(repo);

    const result = await uc.execute({
      businessId: "biz-1",
      name: "X",
      subject: "S",
      body: "B",
      signature: null,
    });

    expect(repo.create).toHaveBeenCalledWith({
      businessId: "biz-1",
      name: "X",
      subject: "S",
      body: "B",
      signature: null,
    });
    expect(result).toEqual(created);
  });
});
