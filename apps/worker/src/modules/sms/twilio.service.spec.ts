import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TwilioService } from "./twilio.service";
import { SmsSendJobData } from "@nudge/shared";

const mockCreate = jest.fn().mockResolvedValue({ sid: "SM_test_sid_123" });

jest.mock("twilio", () => {
  return jest.fn(() => ({
    messages: { create: mockCreate },
  }));
});

describe("TwilioService", () => {
  let service: TwilioService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        TWILIO_ACCOUNT_SID: "ACtest123",
        TWILIO_AUTH_TOKEN: "test_token",
        TWILIO_PHONE_NUMBER: "+15551234567",
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    mockCreate.mockClear();

    const module = await Test.createTestingModule({
      providers: [
        TwilioService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(TwilioService);
  });

  it("should call twilio messages.create with correct params", async () => {
    const jobData: SmsSendJobData = {
      to: "+15559876543",
      body: "Your invoice #1234 is overdue. Please pay at your earliest convenience.",
      businessId: "biz_001",
      invoiceId: "inv_001",
      sequenceStepId: "step_001",
    };

    const sid = await service.sendSms(jobData);

    expect(sid).toBe("SM_test_sid_123");
    expect(mockCreate).toHaveBeenCalledWith({
      to: "+15559876543",
      from: "+15551234567",
      body: "Your invoice #1234 is overdue. Please pay at your earliest convenience.",
      statusCallback: expect.stringContaining("businessId=biz_001"),
    });
  });

  it("should include optional metadata in statusCallback URL", async () => {
    const jobData: SmsSendJobData = {
      to: "+15559876543",
      body: "Payment reminder",
      businessId: "biz_001",
      invoiceId: "inv_002",
    };

    await service.sendSms(jobData);

    const callbackUrl = mockCreate.mock.calls[0][0].statusCallback;
    expect(callbackUrl).toContain("invoiceId=inv_002");
    expect(callbackUrl).not.toContain("sequenceStepId=");
  });

  it("should propagate twilio SDK errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Invalid phone number"));

    const jobData: SmsSendJobData = {
      to: "not-a-number",
      body: "Test",
      businessId: "biz_001",
    };

    await expect(service.sendSms(jobData)).rejects.toThrow(
      "Invalid phone number",
    );
  });
});
