export const AI_TEMPLATE_CLIENT = Symbol("AI_TEMPLATE_CLIENT");

export interface AiTemplateDraft {
  name: string;
  subject: string;
  body: string;
  signature: string;
}

export interface AiTemplateRequest {
  description: string;
  timeoutMs: number;
}

export interface AiTemplateClient {
  generate(request: AiTemplateRequest): Promise<AiTemplateDraft>;
}
