import { CreateDefaultTemplateUseCase } from "./create-default-template.use-case";
import type { TemplateRepository, CreateTemplateInput } from "../domain/template.repository";
import {
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TEMPLATE_SUBJECT,
  DEFAULT_TEMPLATE_BODY,
  DEFAULT_TEMPLATE_SIGNATURE,
} from "./default-template.constants";

describe("CreateDefaultTemplateUseCase", () => {
  it("creates a template with the default constants for the given business", async () => {
    let captured: CreateTemplateInput | null = null;
    const repo = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn((input: CreateTemplateInput) => {
        captured = input;
        return Promise.resolve({
          id: "tpl-1",
          businessId: input.businessId,
          name: input.name,
          subject: input.subject,
          body: input.body,
          signature: input.signature,
          smsBody: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      update: jest.fn(),
      delete: jest.fn(),
      isInUse: jest.fn(),
      attachToCustomer: jest.fn(),
      detachFromCustomer: jest.fn(),
    } satisfies jest.Mocked<TemplateRepository>;

    const uc = new CreateDefaultTemplateUseCase(repo);
    await uc.execute({ businessId: "biz-1" });

    expect(captured).toEqual({
      businessId: "biz-1",
      name: DEFAULT_TEMPLATE_NAME,
      subject: DEFAULT_TEMPLATE_SUBJECT,
      body: DEFAULT_TEMPLATE_BODY,
      signature: DEFAULT_TEMPLATE_SIGNATURE,
    });
  });
});
