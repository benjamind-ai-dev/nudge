import { ConfigService } from "@nestjs/config";
import { TwilioSmsService } from "./twilio-sms.service";

const mockMessagesCreate = jest.fn();

jest.mock("twilio", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  }));
});

describe("TwilioSmsService", () => {
  let service: TwilioSmsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          TWILIO_ACCOUNT_SID: "ACtest123",
          TWILIO_AUTH_TOKEN: "test_auth_token",
          TWILIO_PHONE_NUMBER: "+15551234567",
          APP_BASE_URL: "https://api.nudge.io",
          TWILIO_WEBHOOK_SECRET: "whsec_test123",
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new TwilioSmsService(configService);
  });

  const smsParams = {
    to: "+15559876543",
    body: "Your invoice is overdue",
    businessId: "biz-123",
    invoiceId: "inv-456",
    sequenceStepId: "step-789",
  };

  it("sends SMS and returns external message ID (sid)", async () => {
    mockMessagesCreate.mockResolvedValue({
      sid: "SM1234567890",
      status: "queued",
    });

    const result = await service.send(smsParams);

    expect(result.externalMessageId).toBe("SM1234567890");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: smsParams.to,
      from: "+15551234567",
      body: smsParams.body,
      statusCallback: expect.stringContaining("https://api.nudge.io/v1/webhooks/twilio/status"),
    });
  });

  it("includes business context in status callback URL", async () => {
    mockMessagesCreate.mockResolvedValue({ sid: "SM123" });

    await service.send(smsParams);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const callbackUrl = new URL(callArgs.statusCallback);

    expect(callbackUrl.searchParams.get("secret")).toBe("whsec_test123");
    expect(callbackUrl.searchParams.get("businessId")).toBe("biz-123");
    expect(callbackUrl.searchParams.get("invoiceId")).toBe("inv-456");
    expect(callbackUrl.searchParams.get("sequenceStepId")).toBe("step-789");
  });

  it("propagates Twilio API errors", async () => {
    const twilioError = new Error("Invalid phone number");
    mockMessagesCreate.mockRejectedValue(twilioError);

    await expect(service.send(smsParams)).rejects.toThrow("Invalid phone number");
  });
});
