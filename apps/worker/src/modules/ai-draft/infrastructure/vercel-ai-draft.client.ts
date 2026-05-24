import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type {
  AiDraftClient,
  AiDraftRequest,
  AiDraftResult,
} from "../application/ports/ai-draft.client";
import type { Env } from "../../../common/config/env.schema";

@Injectable()
export class VercelAiDraftClient implements AiDraftClient {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async generate(request: AiDraftRequest): Promise<AiDraftResult> {
    const modelId = this.config.get("AI_DRAFT_MODEL", { infer: true });
    const result = await generateText({
      model: anthropic(modelId),
      system: request.systemPrompt,
      prompt: request.userPrompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      abortSignal: AbortSignal.timeout(request.timeoutMs),
    });
    return {
      text: result.text,
      modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    };
  }
}
