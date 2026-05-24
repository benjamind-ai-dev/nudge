import { VercelAiDraftClient } from "./vercel-ai-draft.client";

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));
jest.mock("@ai-sdk/anthropic", () => ({
  anthropic: jest.fn((id: string) => ({ id })),
}));

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

describe("VercelAiDraftClient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls generateText with the configured model id and request", async () => {
    (generateText as jest.Mock).mockResolvedValue({
      text: "Thanks for reaching out — we will follow up shortly. — Sandra",
      usage: { inputTokens: 220, outputTokens: 80 },
    });

    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiDraftClient(cfg);

    const result = await client.generate({
      systemPrompt: "sys",
      userPrompt: "user",
      temperature: 0.3,
      maxTokens: 300,
      timeoutMs: 10_000,
    });

    expect(anthropic).toHaveBeenCalledWith("claude-sonnet-4-6");
    const call = (generateText as jest.Mock).mock.calls[0][0];
    expect(call.system).toBe("sys");
    expect(call.prompt).toBe("user");
    expect(call.temperature).toBe(0.3);
    expect(call.maxOutputTokens).toBe(300);
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);

    expect(result).toEqual({
      text: "Thanks for reaching out — we will follow up shortly. — Sandra",
      modelId: "claude-sonnet-4-6",
      inputTokens: 220,
      outputTokens: 80,
    });
  });

  it("propagates errors", async () => {
    (generateText as jest.Mock).mockRejectedValue(new Error("upstream"));
    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiDraftClient(cfg);

    await expect(
      client.generate({ systemPrompt: "x", userPrompt: "y", temperature: 0.3, maxTokens: 300, timeoutMs: 10_000 }),
    ).rejects.toThrow("upstream");
  });
});
