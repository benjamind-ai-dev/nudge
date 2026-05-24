import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type {
  AiTemplateClient,
  AiTemplateDraft,
  AiTemplateRequest,
} from "../application/ports/ai-template.client";
import type { Env } from "../../../common/config/env.schema";
import { AI_TEMPLATE_SYSTEM_PROMPT } from "../application/generate-template.use-case";

const draftSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  signature: z.string(),
});

@Injectable()
export class VercelAiTemplateClient implements AiTemplateClient {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async generate(request: AiTemplateRequest): Promise<AiTemplateDraft> {
    const modelId = this.config.get("AI_TEMPLATE_MODEL", { infer: true });
    const result = await generateObject({
      model: anthropic(modelId),
      system: AI_TEMPLATE_SYSTEM_PROMPT,
      prompt: `Sandra wants a template for: ${request.description}`,
      schema: draftSchema,
      abortSignal: AbortSignal.timeout(request.timeoutMs),
    });
    return result.object;
  }
}
