import { VercelAiTemplateClient } from "./vercel-ai-template.client";

jest.mock("ai", () => ({
  generateObject: jest.fn(),
}));
jest.mock("@ai-sdk/anthropic", () => ({
  anthropic: jest.fn((id: string) => ({ id })),
}));

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

describe("VercelAiTemplateClient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls generateObject with the configured model + the system prompt + structured output schema", async () => {
    (generateObject as jest.Mock).mockResolvedValue({
      object: {
        name: "Polite first reminder",
        subject: "Quick note about invoice {{invoice.invoice_number}}",
        body: "Hi {{customer.contact_name}}, ...",
        signature: "Thanks,\n{{business.sender_name}}",
      },
    });

    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiTemplateClient(cfg);

    const result = await client.generate({
      description: "polite first reminder",
      timeoutMs: 15_000,
    });

    expect(anthropic).toHaveBeenCalledWith("claude-sonnet-4-6");
    const call = (generateObject as jest.Mock).mock.calls[0][0];
    expect(call.prompt).toContain("polite first reminder");
    expect(call.system).toBeTruthy();
    expect(call.schema).toBeDefined();
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);

    expect(result.name).toBe("Polite first reminder");
    expect(result.body).toContain("{{customer.contact_name}}");
  });

  it("propagates errors", async () => {
    (generateObject as jest.Mock).mockRejectedValue(new Error("upstream"));
    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiTemplateClient(cfg);

    await expect(
      client.generate({ description: "x", timeoutMs: 15_000 }),
    ).rejects.toThrow("upstream");
  });
});
