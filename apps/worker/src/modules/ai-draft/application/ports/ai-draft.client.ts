export const AI_DRAFT_CLIENT = Symbol("AI_DRAFT_CLIENT");

export interface AiDraftRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface AiDraftResult {
  text: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiDraftClient {
  generate(request: AiDraftRequest): Promise<AiDraftResult>;
}
