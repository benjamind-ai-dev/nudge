import {
  GenerateTemplateUseCase,
  AI_TEMPLATE_SYSTEM_PROMPT,
} from "./generate-template.use-case";
import { BadGatewayException, BadRequestException } from "@nestjs/common";
import type { AiTemplateClient, AiTemplateDraft } from "./ports/ai-template.client";

const VALID_DRAFT: AiTemplateDraft = {
  name: "Polite first reminder",
  subject: "Quick note about invoice {{invoice.invoice_number}}",
  body: "Hi {{customer.contact_name}}, ...",
  signature: "Thanks,\n{{business.sender_name}}",
};

function makeClient(overrides: Partial<jest.Mocked<AiTemplateClient>> = {}) {
  return {
    generate: jest.fn().mockResolvedValue(VALID_DRAFT),
    ...overrides,
  } satisfies jest.Mocked<AiTemplateClient>;
}

describe("GenerateTemplateUseCase", () => {
  it("returns the draft from the AI client with the right request", async () => {
    const client = makeClient();
    const uc = new GenerateTemplateUseCase(client);

    const result = await uc.execute({ description: "polite first reminder" });

    expect(result).toEqual(VALID_DRAFT);
    expect(client.generate).toHaveBeenCalledWith({
      description: "polite first reminder",
      timeoutMs: 15_000,
    });
  });

  it("throws BadRequestException on empty description", async () => {
    const client = makeClient();
    const uc = new GenerateTemplateUseCase(client);

    await expect(uc.execute({ description: "   " })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.generate).not.toHaveBeenCalled();
  });

  it("wraps client failures in BadGatewayException", async () => {
    const client = makeClient({ generate: jest.fn().mockRejectedValue(new Error("upstream")) });
    const uc = new GenerateTemplateUseCase(client);

    await expect(uc.execute({ description: "anything" })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it("strips email addresses from the description before calling the client", async () => {
    const client = makeClient();
    const uc = new GenerateTemplateUseCase(client);

    await uc.execute({ description: "remind john@acme.com about overdue invoice" });

    const call = client.generate.mock.calls[0][0];
    expect(call.description).not.toContain("john@acme.com");
    expect(call.description).toContain("[email removed]");
  });

  it("exposes AI_TEMPLATE_SYSTEM_PROMPT constant", () => {
    expect(typeof AI_TEMPLATE_SYSTEM_PROMPT).toBe("string");
    expect(AI_TEMPLATE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });
});
