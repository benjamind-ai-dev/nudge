import { VercelAiSummaryClient } from "./vercel-ai-summary.client";

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));
jest.mock("@ai-sdk/anthropic", () => ({
  anthropic: jest.fn((id: string) => ({ id })),
}));

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

describe("VercelAiSummaryClient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls generateText with the configured model id and request", async () => {
    (generateText as jest.Mock).mockResolvedValue({
      text: "Recovery up. Chase [CUSTOMER_A].",
      usage: { inputTokens: 120, outputTokens: 40 },
    });

    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiSummaryClient(cfg);

    const result = await client.generate({
      systemPrompt: "sys",
      userPrompt: "user",
      temperature: 0.4,
      maxTokens: 250,
      timeoutMs: 10_000,
    });

    expect(anthropic).toHaveBeenCalledWith("claude-sonnet-4-6");
    const call = (generateText as jest.Mock).mock.calls[0][0];
    expect(call.system).toBe("sys");
    expect(call.prompt).toBe("user");
    expect(call.temperature).toBe(0.4);
    expect(call.maxOutputTokens).toBe(250);
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);

    expect(result).toEqual({
      text: "Recovery up. Chase [CUSTOMER_A].",
      modelId: "claude-sonnet-4-6",
      inputTokens: 120,
      outputTokens: 40,
    });
  });

  it("propagates errors", async () => {
    (generateText as jest.Mock).mockRejectedValue(new Error("upstream"));
    const cfg = { get: () => "claude-sonnet-4-6" } as never;
    const client = new VercelAiSummaryClient(cfg);

    await expect(
      client.generate({ systemPrompt: "x", userPrompt: "y", temperature: 0.4, maxTokens: 250, timeoutMs: 10_000 }),
    ).rejects.toThrow("upstream");
  });
});
