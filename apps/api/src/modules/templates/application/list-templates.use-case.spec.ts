import { ListTemplatesUseCase } from "./list-templates.use-case";
import type { TemplateRepository } from "../domain/template.repository";

describe("ListTemplatesUseCase", () => {
  it("returns the templates with inUse flag from the repo", async () => {
    const fakeTemplates = [
      { id: "t1", businessId: "biz-1", name: "A", subject: null, body: "b", signature: null, createdAt: new Date(), updatedAt: new Date(), inUse: true },
      { id: "t2", businessId: "biz-1", name: "B", subject: null, body: "c", signature: null, createdAt: new Date(), updatedAt: new Date(), inUse: false },
    ];
    const repo = {
      list: jest.fn().mockResolvedValue(fakeTemplates),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      isInUse: jest.fn(),
      attachToCustomer: jest.fn(),
      detachFromCustomer: jest.fn(),
    } satisfies jest.Mocked<TemplateRepository>;

    const uc = new ListTemplatesUseCase(repo);
    const result = await uc.execute({ businessId: "biz-1" });

    expect(repo.list).toHaveBeenCalledWith("biz-1");
    expect(result).toEqual(fakeTemplates);
    expect(result[0].inUse).toBe(true);
    expect(result[1].inUse).toBe(false);
  });
});
