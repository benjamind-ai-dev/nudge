export const AI_SUMMARY_CLIENT = Symbol("AI_SUMMARY_CLIENT");

export interface AiSummaryRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface AiSummaryResult {
  text: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiSummaryClient {
  generate(request: AiSummaryRequest): Promise<AiSummaryResult>;
}
