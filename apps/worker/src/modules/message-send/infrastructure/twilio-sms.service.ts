import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { SmsService, SendSmsParams, SendSmsResult } from "../domain/sms.service";
import { Env } from "../../../common/config/env.schema";

@Injectable()
export class TwilioSmsService implements SmsService {
  private readonly logger = new Logger(TwilioSmsService.name);
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = Twilio(
      this.config.get("TWILIO_ACCOUNT_SID", { infer: true }),
      this.config.get("TWILIO_AUTH_TOKEN", { infer: true }),
    );
    this.fromNumber = this.config.get("TWILIO_PHONE_NUMBER", { infer: true });
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const statusCallback = this.buildStatusCallbackUrl(params);

    const message = await this.client.messages.create({
      to: params.to,
      from: this.fromNumber,
      body: params.body,
      statusCallback,
    });

    this.logger.log({
      msg: "SMS sent via Twilio",
      event: "sms_sent",
      to: params.to,
      sid: message.sid,
      businessId: params.businessId,
    });

    return {
      externalMessageId: message.sid,
    };
  }

  private buildStatusCallbackUrl(params: SendSmsParams): string {
    const queryParams = new URLSearchParams({
      secret: "placeholder",
      businessId: params.businessId,
      invoiceId: params.invoiceId,
      sequenceStepId: params.sequenceStepId,
    });

    return `https://api.paynudge.net/v1/webhooks/twilio/status?${queryParams.toString()}`;
  }
}
