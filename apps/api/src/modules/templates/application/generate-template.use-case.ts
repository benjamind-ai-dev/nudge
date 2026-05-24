import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  AI_TEMPLATE_CLIENT,
  type AiTemplateClient,
  type AiTemplateDraft,
} from "./ports/ai-template.client";

export const AI_TEMPLATE_SYSTEM_PROMPT =
  "You are an assistant that drafts professional, polite accounts-receivable email templates for a small business owner. " +
  "Given a brief description, produce a single template suitable for use as a follow-up email. " +
  "Use these mustache-style variables where appropriate: {{customer.company_name}}, {{customer.contact_name}}, " +
  "{{invoice.invoice_number}}, {{invoice.amount}}, {{invoice.balance_due}}, {{invoice.due_date}}, {{invoice.days_overdue}}, " +
  "{{invoice.payment_link}}, {{business.sender_name}}. Keep the body under 150 words. Never be aggressive. Sign off with the sender's name.";

export interface GenerateTemplateInput {
  description: string;
}

@Injectable()
export class GenerateTemplateUseCase {
  private readonly logger = new Logger(GenerateTemplateUseCase.name);

  constructor(
    @Inject(AI_TEMPLATE_CLIENT) private readonly client: AiTemplateClient,
  ) {}

  async execute(input: GenerateTemplateInput): Promise<AiTemplateDraft> {
    const description = input.description.trim();
    if (!description) {
      throw new BadRequestException("description is required");
    }

    try {
      return await this.client.generate({ description, timeoutMs: 15_000 });
    } catch (err) {
      this.logger.error({
        msg: "AI template generation failed",
        event: "ai_template_generate_failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw new BadGatewayException("Template generation failed");
    }
  }
}
