import { Inject, Injectable, Logger } from "@nestjs/common";
import { anonymize, deAnonymize } from "../domain/anonymizer";
import {
  AI_DRAFT_CLIENT,
  type AiDraftClient,
} from "./ports/ai-draft.client";
import {
  AI_DRAFT_REPOSITORY,
  type AiDraftRepository,
} from "./ports/ai-draft.repository";
import { buildUserPrompt } from "./build-user-prompt";

export const AI_DRAFT_SYSTEM_PROMPT =
  "You are a professional accounts receivable assistant. Draft a polite, concise reply to a client who responded to an invoice follow-up. Be empathetic, professional, and solution-oriented. Never be aggressive. Keep the reply under 150 words. Sign off with the sender's name.";

export interface GenerateAiDraftInput {
  messageId: string;
  businessId: string;
}

export interface GenerateAiDraftResult {
  generated: boolean;
  skipReason?: "not_found" | "no_reply_body" | "claude_error";
  durationMs: number;
}

@Injectable()
export class GenerateAiDraftUseCase {
  private readonly logger = new Logger(GenerateAiDraftUseCase.name);

  constructor(
    @Inject(AI_DRAFT_CLIENT) private readonly client: AiDraftClient,
    @Inject(AI_DRAFT_REPOSITORY) private readonly repo: AiDraftRepository,
  ) {}

  async execute(input: GenerateAiDraftInput): Promise<GenerateAiDraftResult> {
    const started = Date.now();

    const ctx = await this.repo.findMessageContext(input.messageId, input.businessId);
    if (!ctx) {
      this.logger.warn({
        msg: "Skipping ai-draft: message not found",
        event: "ai_draft_skipped",
        reason: "not_found",
        messageId: input.messageId,
        businessId: input.businessId,
      });
      return { generated: false, skipReason: "not_found", durationMs: Date.now() - started };
    }

    if (!ctx.message.replyBody) {
      this.logger.warn({
        msg: "Skipping ai-draft: no reply body",
        event: "ai_draft_skipped",
        reason: "no_reply_body",
        messageId: input.messageId,
        businessId: input.businessId,
      });
      return { generated: false, skipReason: "no_reply_body", durationMs: Date.now() - started };
    }

    const map = {
      companyName: ctx.customer.companyName,
      contactName: ctx.customer.contactName,
    };
    const anonReply = anonymize(ctx.message.replyBody, map);
    const anonOriginal = anonymize(ctx.message.body, map);

    const userPrompt = buildUserPrompt({
      senderName: ctx.business.senderName,
      invoice: {
        invoiceNumber: ctx.invoice.invoiceNumber,
        balanceDueCents: ctx.invoice.balanceDueCents,
        dueDate: ctx.invoice.dueDate,
        daysOverdue: ctx.invoice.daysOverdue,
      },
      anonymizedOriginalBody: anonOriginal.text,
      anonymizedReplyBody: anonReply.text,
    });

    let draft: string | null;
    try {
      const result = await this.client.generate({
        systemPrompt: AI_DRAFT_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.3,
        maxTokens: 300,
        timeoutMs: 10_000,
      });
      draft = deAnonymize(result.text, map, anonReply.placeholders);
    } catch (err) {
      this.logger.error({
        msg: "Claude call failed; leaving draft null",
        event: "ai_draft_claude_error",
        error: err instanceof Error ? err.message : String(err),
        messageId: input.messageId,
        businessId: input.businessId,
      });
      await this.repo.saveDraft(input.messageId, input.businessId, null);
      return { generated: false, skipReason: "claude_error", durationMs: Date.now() - started };
    }

    await this.repo.saveDraft(input.messageId, input.businessId, draft);
    return { generated: true, durationMs: Date.now() - started };
  }
}
