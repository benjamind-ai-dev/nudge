import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { EmailService, SendEmailParams, SendEmailResult } from "../domain/email.service";
import { Env } from "../../../common/config/env.schema";

@Injectable()
export class ResendEmailService implements EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly client: Resend;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = new Resend(this.config.get("RESEND_API_KEY", { infer: true }));
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const response = await this.client.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (response.error) {
      this.logger.error({
        msg: "Resend API error",
        event: "resend_send_error",
        errorName: response.error.name,
        errorMessage: response.error.message,
      });
      throw new Error(`Resend error: ${response.error.message}`);
    }

    const externalMessageId = response.data?.id;
    if (!externalMessageId) {
      this.logger.error({
        msg: "Resend returned success but no message ID",
        event: "resend_missing_id",
      });
      throw new Error("Resend returned success but no message ID");
    }

    this.logger.log({
      msg: "Email sent via Resend",
      event: "email_sent",
      externalMessageId,
    });

    return { externalMessageId };
  }
}
