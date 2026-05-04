import type { BusinessMetrics } from "./business-metrics";

export type WeeklySummaryStatus = "pending" | "sent" | "skipped" | "failed";

export interface WeeklySummaryProps {
  id: string;
  businessId: string;
  weekStartsAt: string;
  status: WeeklySummaryStatus;
  aiParagraph: string | null;
  aiModel: string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  metrics: BusinessMetrics | Record<string, never>;
  recipientEmails: string[];
  resendMessageIds: string[];
  errorMessage: string | null;
  sentAt: Date | null;
}

export interface MarkSentInput {
  aiParagraph: string | null;
  aiModel: string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  metrics: BusinessMetrics;
  recipientEmails: string[];
  resendMessageIds: string[];
  sentAt: Date;
}

export class WeeklySummary {
  private constructor(public readonly props: WeeklySummaryProps) {}

  static create(input: { id: string; businessId: string; weekStartsAt: string }): WeeklySummary {
    return new WeeklySummary({
      id: input.id,
      businessId: input.businessId,
      weekStartsAt: input.weekStartsAt,
      status: "pending",
      aiParagraph: null,
      aiModel: null,
      aiInputTokens: null,
      aiOutputTokens: null,
      metrics: {},
      recipientEmails: [],
      resendMessageIds: [],
      errorMessage: null,
      sentAt: null,
    });
  }

  static fromPersistence(props: WeeklySummaryProps): WeeklySummary {
    return new WeeklySummary(props);
  }

  get status() { return this.props.status; }
  get aiParagraph() { return this.props.aiParagraph; }
  get errorMessage() { return this.props.errorMessage; }
  get metrics() { return this.props.metrics; }
  get recipientEmails() { return this.props.recipientEmails; }

  markSkipped(metrics: BusinessMetrics): WeeklySummary {
    this.assertPending();
    return new WeeklySummary({ ...this.props, status: "skipped", metrics });
  }

  markSent(input: MarkSentInput): WeeklySummary {
    this.assertPending();
    return new WeeklySummary({
      ...this.props,
      status: "sent",
      aiParagraph: input.aiParagraph,
      aiModel: input.aiModel,
      aiInputTokens: input.aiInputTokens,
      aiOutputTokens: input.aiOutputTokens,
      metrics: input.metrics,
      recipientEmails: input.recipientEmails,
      resendMessageIds: input.resendMessageIds,
      sentAt: input.sentAt,
    });
  }

  markFailed(errorMessage: string): WeeklySummary {
    this.assertPending();
    return new WeeklySummary({ ...this.props, status: "failed", errorMessage });
  }

  private assertPending() {
    if (this.props.status !== "pending") {
      throw new Error(`Cannot transition WeeklySummary in status ${this.props.status}`);
    }
  }
}
