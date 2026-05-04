import { Prisma } from "@nudge/database";
import { GenerateWeeklySummaryUseCase } from "./generate-weekly-summary.use-case";
import { BuildSummaryPromptUseCase } from "./build-summary-prompt.use-case";
import { WeeklySummary } from "../domain/weekly-summary.entity";
import type { WeeklySummaryRepository } from "../domain/weekly-summary.repository";
import type { MetricsRepository } from "../domain/metrics.repository";
import type { AiSummaryClient } from "./ports/ai-summary.client";
import type { SummaryEmailSender } from "./ports/summary-email.sender";
import type { BusinessMetrics } from "../domain/business-metrics";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../../common/config/env.schema";

const business = {
  id: "b1",
  accountId: "acc1",
  name: "Sandra's Bakery",
  timezone: "America/New_York",
  senderEmail: "no-reply@nudge.io",
  senderName: "Nudge",
};

const owners = [
  { userId: "u1", email: "sandra@bakery.com" },
];

const nonEmptyMetrics: BusinessMetrics = {
  weekStartsAt: "2026-05-04",
  recoveredThisWeekCents: 1_280_000,
  recoveredPriorWeekCents: 1_040_000,
  invoicesCollectedCount: 14,
  avgDaysToPayThisWeek: 32,
  avgDaysToPayTrailing4Weeks: 38,
  currentlyOverdueCount: 9,
  topOverdueCustomers: [
    { customerId: "c1", customerName: "Midwest Plastics", totalOutstandingCents: 250_000, oldestInvoiceDaysOverdue: 45 },
  ],
  flaggedRuns: [],
  activeSequencesCount: 12,
  top5OverdueInvoices: [],
};

const emptyMetrics: BusinessMetrics = {
  ...nonEmptyMetrics,
  recoveredThisWeekCents: 0,
  invoicesCollectedCount: 0,
  currentlyOverdueCount: 0,
  topOverdueCustomers: [],
  activeSequencesCount: 0,
  top5OverdueInvoices: [],
};

interface Mocks {
  weeklyRepo: jest.Mocked<WeeklySummaryRepository>;
  metricsRepo: jest.Mocked<MetricsRepository>;
  ai: jest.Mocked<AiSummaryClient>;
  sender: jest.Mocked<SummaryEmailSender>;
  renderer: { render: jest.Mock };
}

function makeMocks(overrides: { metrics?: BusinessMetrics } = {}): Mocks {
  return {
    weeklyRepo: {
      insertPending: jest.fn().mockImplementation(async ({ businessId, weekStartsAt }) =>
        WeeklySummary.create({ id: "ws1", businessId, weekStartsAt }),
      ),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockResolvedValue(undefined),
    },
    metricsRepo: {
      loadBusiness: jest.fn().mockResolvedValue(business),
      loadOwnerRecipients: jest.fn().mockResolvedValue(owners),
      computeMetrics: jest.fn().mockResolvedValue(overrides.metrics ?? nonEmptyMetrics),
    },
    ai: {
      generate: jest.fn().mockResolvedValue({
        text: "Recovery is up. Chase [CUSTOMER_A] this week.",
        modelId: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 30,
      }),
    },
    sender: {
      send: jest.fn().mockResolvedValue({ externalMessageId: "rs_1" }),
    },
    renderer: {
      render: jest.fn().mockReturnValue({ html: "<html>x</html>", text: "x" }),
    },
  };
}

const fakeConfig = { get: () => "http://localhost:5173" } as unknown as ConfigService<Env, true>;

function makeUseCase(m: Mocks) {
  return new GenerateWeeklySummaryUseCase(
    m.weeklyRepo,
    m.metricsRepo,
    new BuildSummaryPromptUseCase(),
    m.ai,
    m.sender,
    m.renderer as never,
    fakeConfig,
  );
}

describe("GenerateWeeklySummaryUseCase", () => {
  it("happy path: inserts pending → marks sent with AI paragraph and recipients", async () => {
    const m = makeMocks();
    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(m.weeklyRepo.insertPending).toHaveBeenCalledWith({ businessId: "b1", weekStartsAt: "2026-05-04" });
    expect(m.ai.generate).toHaveBeenCalled();
    expect(m.sender.send).toHaveBeenCalledTimes(1);
    expect(m.weeklyRepo.save).toHaveBeenCalled();
    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.status).toBe("sent");
    expect(saved.props.aiParagraph).toContain("Midwest Plastics");
    expect(saved.props.recipientEmails).toEqual(["sandra@bakery.com"]);
    expect(saved.props.resendMessageIds).toEqual(["rs_1"]);
  });

  it("skip rule: marks skipped when there's nothing to summarize, no email sent", async () => {
    const m = makeMocks({ metrics: emptyMetrics });
    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(m.ai.generate).not.toHaveBeenCalled();
    expect(m.sender.send).not.toHaveBeenCalled();
    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.status).toBe("skipped");
  });

  it("AI failure: still sends email without paragraph", async () => {
    const m = makeMocks();
    m.ai.generate.mockRejectedValueOnce(new Error("timeout"));

    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(m.sender.send).toHaveBeenCalledTimes(1);
    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.status).toBe("sent");
    expect(saved.props.aiParagraph).toBeNull();
  });

  it("AI validation rejection: real name leak → drops paragraph, still sends", async () => {
    const m = makeMocks();
    m.ai.generate.mockResolvedValueOnce({
      text: "Chase Midwest Plastics this week.",
      modelId: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 10,
    });

    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.status).toBe("sent");
    expect(saved.props.aiParagraph).toBeNull();
  });

  it("AI validation rejection: unknown tag → drops paragraph", async () => {
    const m = makeMocks();
    m.ai.generate.mockResolvedValueOnce({
      text: "Chase [CUSTOMER_Z] this week.",
      modelId: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 10,
    });

    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.aiParagraph).toBeNull();
  });

  it("no owners: marks failed without retry", async () => {
    const m = makeMocks();
    m.metricsRepo.loadOwnerRecipients.mockResolvedValueOnce([]);

    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(m.sender.send).not.toHaveBeenCalled();
    const saved = m.weeklyRepo.save.mock.calls[0][0];
    expect(saved.props.status).toBe("failed");
    expect(saved.props.errorMessage).toBe("no owner users");
  });

  it("Resend send error: throws (so BullMQ retries)", async () => {
    const m = makeMocks();
    m.sender.send.mockRejectedValueOnce(new Error("resend boom"));

    await expect(
      makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" }),
    ).rejects.toThrow("resend boom");
  });

  it("idempotency collision: returns silently when insertPending throws P2002", async () => {
    const m = makeMocks();
    const dupErr = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "test",
    });
    m.weeklyRepo.insertPending.mockRejectedValueOnce(dupErr);

    await makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" });

    expect(m.ai.generate).not.toHaveBeenCalled();
    expect(m.sender.send).not.toHaveBeenCalled();
    expect(m.weeklyRepo.save).not.toHaveBeenCalled();
  });

  it("propagates non-P2002 errors from insertPending (allows BullMQ retry)", async () => {
    const m = makeMocks();
    m.weeklyRepo.insertPending.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      makeUseCase(m).execute({ businessId: "b1", weekStartsAt: "2026-05-04" }),
    ).rejects.toThrow("connection lost");
  });
});
