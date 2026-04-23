import { ConfigService } from "@nestjs/config";
import { ResendEmailService } from "./resend-email.service";

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("ResendEmailService", () => {
  let service: ResendEmailService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue("re_test_api_key"),
    } as unknown as jest.Mocked<ConfigService>;

    service = new ResendEmailService(configService);
  });

  const emailParams = {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Test Subject",
    html: "<p>Test body</p>",
  };

  it("sends email and returns external message ID", async () => {
    mockSend.mockResolvedValue({
      data: { id: "resend-msg-123" },
      error: null,
    });

    const result = await service.send(emailParams);

    expect(result.externalMessageId).toBe("resend-msg-123");
    expect(mockSend).toHaveBeenCalledWith({
      from: emailParams.from,
      to: emailParams.to,
      subject: emailParams.subject,
      html: emailParams.html,
    });
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key" },
    });

    await expect(service.send(emailParams)).rejects.toThrow(
      "Resend error: Invalid API key",
    );
  });

  it("throws when Resend returns success but no message ID", async () => {
    mockSend.mockResolvedValue({
      data: { id: undefined },
      error: null,
    });

    await expect(service.send(emailParams)).rejects.toThrow(
      "Resend returned success but no message ID",
    );
  });

  it("throws when Resend returns success with null data", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(service.send(emailParams)).rejects.toThrow(
      "Resend returned success but no message ID",
    );
  });
});
