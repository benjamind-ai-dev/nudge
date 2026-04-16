import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import { SmsSendJobData } from "@nudge/shared";
import { Env } from "../../common/config/env.schema";

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = Twilio(
      this.config.get("TWILIO_ACCOUNT_SID", { infer: true }),
      this.config.get("TWILIO_AUTH_TOKEN", { infer: true }),
    );
    this.fromNumber = this.config.get("TWILIO_PHONE_NUMBER", { infer: true });
  }

  async sendSms(data: SmsSendJobData): Promise<string> {
    const statusCallback = this.buildStatusCallbackUrl(data);

    const message = await this.client.messages.create({
      to: data.to,
      from: this.fromNumber,
      body: data.body,
      statusCallback,
    });

    this.logger.log(
      `SMS sent to ${data.to} — SID: ${message.sid}, businessId: ${data.businessId}`,
    );

    return message.sid;
  }

  private buildStatusCallbackUrl(data: SmsSendJobData): string {
    const params = new URLSearchParams({
      secret: "placeholder",
      businessId: data.businessId,
    });

    if (data.invoiceId) {
      params.set("invoiceId", data.invoiceId);
    }
    if (data.sequenceStepId) {
      params.set("sequenceStepId", data.sequenceStepId);
    }

    return `https://api.paynudge.net/v1/webhooks/twilio/status?${params.toString()}`;
  }
}
