import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { format } from "date-fns";
import {
  WEEKLY_SUMMARY_REPOSITORY,
  type WeeklySummaryRepository,
} from "../domain/weekly-summary.repository";
import {
  METRICS_REPOSITORY,
  type MetricsRepository,
} from "../domain/metrics.repository";
import { isMetricsEmpty, type BusinessMetrics } from "../domain/business-metrics";
import { BuildSummaryPromptUseCase } from "./build-summary-prompt.use-case";
import {
  AI_SUMMARY_CLIENT,
  type AiSummaryClient,
} from "./ports/ai-summary.client";
import {
  SUMMARY_EMAIL_SENDER,
  type SummaryEmailSender,
} from "./ports/summary-email.sender";
import type { Env } from "../../../common/config/env.schema";

export interface SummaryRenderer {
  render(input: {
    businessName: string;
    weekStartsAt: string;
    aiParagraph: string | null;
    metrics: BusinessMetrics;
    dashboardUrl: string;
  }): { html: string; text: string };
}

export const SUMMARY_RENDERER = Symbol("SUMMARY_RENDERER");

@Injectable()
export class GenerateWeeklySummaryUseCase {
  private readonly logger = new Logger(GenerateWeeklySummaryUseCase.name);

  constructor(
    @Inject(WEEKLY_SUMMARY_REPOSITORY)
    private readonly repo: WeeklySummaryRepository,
    @Inject(METRICS_REPOSITORY)
    private readonly metrics: MetricsRepository,
    private readonly buildPrompt: BuildSummaryPromptUseCase,
    @Inject(AI_SUMMARY_CLIENT)
    private readonly ai: AiSummaryClient,
    @Inject(SUMMARY_EMAIL_SENDER)
    private readonly sender: SummaryEmailSender,
    @Inject(SUMMARY_RENDERER)
    private readonly renderer: SummaryRenderer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(input: { businessId: string; weekStartsAt: string }): Promise<void> {
    let summary;
    try {
      summary = await this.repo.insertPending(input);
    } catch {
      this.logger.log({
        msg: "Skipping duplicate weekly summary dispatch",
        event: "weekly_summary_duplicate",
        businessId: input.businessId,
        weekStartsAt: input.weekStartsAt,
      });
      return;
    }

    const business = await this.metrics.loadBusiness(input.businessId);
    if (!business) {
      await this.repo.save(summary.markFailed("business not found"));
      return;
    }

    const metrics = await this.metrics.computeMetrics(input);

    if (isMetricsEmpty(metrics)) {
      await this.repo.save(summary.markSkipped(metrics));
      return;
    }

    const recipients = await this.metrics.loadOwnerRecipients(business.accountId);
    if (recipients.length === 0) {
      await this.repo.save(summary.markFailed("no owner users"));
      return;
    }

    const { systemPrompt, userPrompt, tagMap } = this.buildPrompt.execute(metrics);

    let aiParagraph: string | null = null;
    let aiModel: string | null = null;
    let aiInputTokens: number | null = null;
    let aiOutputTokens: number | null = null;

    try {
      const aiResult = await this.ai.generate({
        systemPrompt,
        userPrompt,
        temperature: 0.4,
        maxTokens: 250,
        timeoutMs: 10_000,
      });

      const validation = tagMap.validate(aiResult.text);
      if (validation.unknownTags.length > 0) {
        this.logger.warn({
          msg: "AI output contained unknown tags",
          event: "weekly_summary_ai_unknown_tags",
          businessId: input.businessId,
          unknownTags: validation.unknownTags,
        });
      } else if (tagMap.containsAnyRealName(aiResult.text)) {
        this.logger.warn({
          msg: "AI output leaked a real customer name",
          event: "weekly_summary_ai_real_name_leak",
          businessId: input.businessId,
        });
      } else {
        aiParagraph = tagMap.substitute(aiResult.text);
        aiModel = aiResult.modelId;
        aiInputTokens = aiResult.inputTokens;
        aiOutputTokens = aiResult.outputTokens;
      }
    } catch (err) {
      this.logger.warn({
        msg: "AI summary generation failed; sending metrics-only email",
        event: "weekly_summary_ai_error",
        businessId: input.businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const dashboardUrl = `${this.config.get("FRONTEND_URL", { infer: true })}/dashboard`;

    const rendered = this.renderer.render({
      businessName: business.name,
      weekStartsAt: input.weekStartsAt,
      aiParagraph,
      metrics,
      dashboardUrl,
    });

    const subject = `Your Nudge weekly summary — week of ${format(new Date(input.weekStartsAt), "MMM d, yyyy")}`;

    const messageIds: string[] = [];
    for (const r of recipients) {
      const result = await this.sender.send({
        from: `${business.senderName} <${business.senderEmail}>`,
        to: r.email,
        subject,
        html: rendered.html,
        text: rendered.text,
      });
      messageIds.push(result.externalMessageId);
    }

    await this.repo.save(
      summary.markSent({
        aiParagraph,
        aiModel,
        aiInputTokens,
        aiOutputTokens,
        metrics,
        recipientEmails: recipients.map((r) => r.email),
        resendMessageIds: messageIds,
        sentAt: new Date(),
      }),
    );
  }
}
