import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type {
  SendSummaryResult,
  SummaryEmail,
  SummaryEmailSender,
} from "../application/ports/summary-email.sender";
import type { Env } from "../../../common/config/env.schema";

@Injectable()
export class ResendSummaryEmailSender implements SummaryEmailSender {
  private readonly logger = new Logger(ResendSummaryEmailSender.name);
  private readonly client: Resend;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Resend(config.get("RESEND_API_KEY", { infer: true }));
  }

  async send(email: SummaryEmail): Promise<SendSummaryResult> {
    const response = await this.client.emails.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (response.error) {
      this.logger.error({
        msg: "Resend error sending weekly summary",
        event: "weekly_summary_resend_error",
        errorName: response.error.name,
        errorMessage: response.error.message,
      });
      throw new Error(`Resend error: ${response.error.message}`);
    }

    const externalMessageId = response.data?.id;
    if (!externalMessageId) {
      throw new Error("Resend returned success without a message ID");
    }
    return { externalMessageId };
  }
}
