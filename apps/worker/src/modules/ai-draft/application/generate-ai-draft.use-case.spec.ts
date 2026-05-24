import { GenerateAiDraftUseCase, AI_DRAFT_SYSTEM_PROMPT } from "./generate-ai-draft.use-case";
import type { AiDraftClient } from "./ports/ai-draft.client";
import type { AiDraftRepository, AiDraftMessageContext } from "./ports/ai-draft.repository";

function makeCtx(overrides: Partial<AiDraftMessageContext> = {}): AiDraftMessageContext {
  return {
    message: { id: "m-1", body: "Hello John Miller, please pay.", replyBody: "We dispute this." },
    invoice: {
      invoiceNumber: "INV-1042",
      balanceDueCents: 250000,
      currency: "USD",
      dueDate: new Date("2026-04-15T00:00:00Z"),
      daysOverdue: 39,
    },
    customer: { companyName: "Midwest Plastics", contactName: "John Miller" },
    business: { senderName: "Sandra Owens" },
    ...overrides,
  };
}

function makeRepo(initial: AiDraftMessageContext | null) {
  return {
    findMessageContext: jest.fn().mockResolvedValue(initial),
    saveDraft: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<AiDraftRepository>;
}

function makeClient(text: string): jest.Mocked<AiDraftClient> {
  return {
    generate: jest.fn().mockResolvedValue({
      text,
      modelId: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 50,
    }),
  };
}

describe("GenerateAiDraftUseCase", () => {
  it("generates a draft, de-anonymizes it, and persists it", async () => {
    const ctx = makeCtx();
    const repo = makeRepo(ctx);
    const client = makeClient("Hi the client contact, thanks for reaching out. — Sandra Owens");
    const uc = new GenerateAiDraftUseCase(client, repo);

    const result = await uc.execute({ messageId: "m-1", businessId: "biz-1" });

    expect(result.generated).toBe(true);
    expect(repo.saveDraft).toHaveBeenCalledWith(
      "m-1",
      "biz-1",
      "Hi John Miller, thanks for reaching out. — Sandra Owens",
    );

    const sentPrompt = client.generate.mock.calls[0][0].userPrompt;
    expect(sentPrompt).not.toContain("Midwest Plastics");
    expect(sentPrompt).not.toContain("John Miller");

    expect(client.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: AI_DRAFT_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 300,
        timeoutMs: 10_000,
      }),
    );
  });

  it("skips with reason 'not_found' when message context missing", async () => {
    const repo = makeRepo(null);
    const client = makeClient("unused");
    const uc = new GenerateAiDraftUseCase(client, repo);

    const result = await uc.execute({ messageId: "missing", businessId: "biz-1" });

    expect(result).toMatchObject({ generated: false, skipReason: "not_found" });
    expect(client.generate).not.toHaveBeenCalled();
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("skips with reason 'no_reply_body' when replyBody is null", async () => {
    const ctx = makeCtx({ message: { id: "m-1", body: "x", replyBody: null } });
    const repo = makeRepo(ctx);
    const client = makeClient("unused");
    const uc = new GenerateAiDraftUseCase(client, repo);

    const result = await uc.execute({ messageId: "m-1", businessId: "biz-1" });

    expect(result).toMatchObject({ generated: false, skipReason: "no_reply_body" });
    expect(client.generate).not.toHaveBeenCalled();
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("on Claude failure: persists null draft, does NOT throw", async () => {
    const ctx = makeCtx();
    const repo = makeRepo(ctx);
    const client: jest.Mocked<AiDraftClient> = {
      generate: jest.fn().mockRejectedValue(new Error("timeout")),
    };
    const uc = new GenerateAiDraftUseCase(client, repo);

    const result = await uc.execute({ messageId: "m-1", businessId: "biz-1" });

    expect(result).toMatchObject({ generated: false, skipReason: "claude_error" });
    expect(repo.saveDraft).toHaveBeenCalledWith("m-1", "biz-1", null);
  });

  it("re-throws when the DB save fails after successful generation (so BullMQ can retry)", async () => {
    const ctx = makeCtx();
    const repo = {
      findMessageContext: jest.fn().mockResolvedValue(ctx),
      saveDraft: jest.fn().mockRejectedValue(new Error("db blip")),
    } satisfies jest.Mocked<AiDraftRepository>;
    const client = makeClient("ok");
    const uc = new GenerateAiDraftUseCase(client, repo);

    await expect(
      uc.execute({ messageId: "m-1", businessId: "biz-1" }),
    ).rejects.toThrow("db blip");
  });
});
