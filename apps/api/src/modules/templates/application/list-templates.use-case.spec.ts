import { ListTemplatesUseCase } from "./list-templates.use-case";
import type { TemplateRepository } from "../domain/template.repository";

describe("ListTemplatesUseCase", () => {
  it("returns the templates the repo finds for the given business", async () => {
    const fakeTemplates = [
      { id: "t1", businessId: "biz-1", name: "A", subject: null, body: "b", signature: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const repo = {
      list: jest.fn().mockResolvedValue(fakeTemplates),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      attachToCustomer: jest.fn(),
      detachFromCustomer: jest.fn(),
    } satisfies jest.Mocked<TemplateRepository>;

    const uc = new ListTemplatesUseCase(repo);
    const result = await uc.execute({ businessId: "biz-1" });

    expect(repo.list).toHaveBeenCalledWith("biz-1");
    expect(result).toEqual(fakeTemplates);
  });
});
