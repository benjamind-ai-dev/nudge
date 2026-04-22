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
        error: response.error,
        to: params.to,
      });
      throw new Error(`Resend error: ${response.error.message}`);
    }

    this.logger.log({
      msg: "Email sent via Resend",
      event: "email_sent",
      to: params.to,
      externalMessageId: response.data?.id,
    });

    return {
      externalMessageId: response.data?.id ?? "",
    };
  }
}
