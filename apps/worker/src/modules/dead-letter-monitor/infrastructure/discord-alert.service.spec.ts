import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DiscordAlertService } from "./discord-alert.service";
import type { AlertPayload } from "../domain/alert.service";

describe("DiscordAlertService", () => {
  let service: DiscordAlertService;
  let configService: jest.Mocked<ConfigService>;

  const mockPayload: AlertPayload = {
    summary: {
      totalCount: 2,
      byQueue: { "message-send": 1, "token-refresh": 1 },
      jobs: [
        {
          originalQueue: "message-send",
          originalJobId: "send-123",
          data: { businessId: "biz-1" },
          failedReason: "Resend API error: rate limited",
          failedAt: "2026-04-26T10:30:00.000Z",
        },
        {
          originalQueue: "token-refresh",
          originalJobId: "refresh-456",
          data: { businessId: "biz-2" },
          failedReason: "Xero refresh token expired",
          failedAt: "2026-04-26T09:00:00.000Z",
        },
      ],
      severity: "critical",
    },
    stuckJobs: [],
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const module = await Test.createTestingModule({
      providers: [
        DiscordAlertService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DiscordAlertService);
  });

  it("logs to console when Discord webhook is not configured", async () => {
    configService.get.mockReturnValue(undefined);

    const logSpy = jest.spyOn(service["logger"], "warn");

    await service.send(mockPayload);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "dead_letter_alert_console",
        deadJobCount: 2,
        severity: "critical",
      }),
    );
  });

  it("sends to Discord when webhook is configured", async () => {
    const webhookUrl = "https://discord.com/api/webhooks/123/abc";
    const mockConfigService = { get: jest.fn().mockReturnValue(webhookUrl) };

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        DiscordAlertService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    const serviceWithWebhook = module.get(DiscordAlertService);
    const logSpy = jest.spyOn(serviceWithWebhook["logger"], "log");

    await serviceWithWebhook.send(mockPayload);

    expect(fetchSpy).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "discord_alert_sent",
      }),
    );

    fetchSpy.mockRestore();
  });

  it("falls back to console when Discord API fails", async () => {
    const webhookUrl = "https://discord.com/api/webhooks/123/abc";
    const mockConfigService = { get: jest.fn().mockReturnValue(webhookUrl) };

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        DiscordAlertService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    const serviceWithWebhook = module.get(DiscordAlertService);
    const errorSpy = jest.spyOn(serviceWithWebhook["logger"], "error");

    await serviceWithWebhook.send(mockPayload);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "discord_alert_failed",
      }),
    );

    fetchSpy.mockRestore();
  });

  it("formats message with severity emoji", async () => {
    configService.get.mockReturnValue(undefined);

    const logSpy = jest.spyOn(service["logger"], "warn");

    await service.send(mockPayload);

    const logCall = logSpy.mock.calls[0][0] as { formattedMessage: string };
    expect(logCall.formattedMessage).toContain("🔴");
    expect(logCall.formattedMessage).toContain("CRITICAL");
  });

  it("includes stuck jobs in message", async () => {
    configService.get.mockReturnValue(undefined);

    const payloadWithStuck: AlertPayload = {
      ...mockPayload,
      stuckJobs: [
        {
          queue: "message-send",
          jobId: "job-999",
          jobName: "send-message",
          data: { businessId: "biz-3" },
          runningForMinutes: 45,
        },
      ],
    };

    const logSpy = jest.spyOn(service["logger"], "warn");

    await service.send(payloadWithStuck);

    const logCall = logSpy.mock.calls[0][0] as { formattedMessage: string };
    expect(logCall.formattedMessage).toContain("Stuck Jobs");
    expect(logCall.formattedMessage).toContain("45");
  });
});
