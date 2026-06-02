import { PLAN_LIMITS } from "@nudge/shared";
import { UpdateStepUseCase } from "./update-step.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { SequenceStep } from "../domain/sequence.entity";
import { SmsNotAvailableOnPlanError } from "../domain/sequence.errors";
import type { EntitlementsService } from "../../../common/entitlements/entitlements.service";

const mkStep = (over: Partial<SequenceStep> = {}): SequenceStep => ({
  id: "step-1",
  stepOrder: 1,
  delayDays: 3,
  channel: "email",
  subjectTemplate: null,
  bodyTemplate: "Body",
  smsBodyTemplate: null,
  isOwnerAlert: false,
  includePaymentLink: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const makeRepo = (over: Partial<SequenceRepository> = {}): SequenceRepository =>
  ({
    updateStep: jest.fn().mockResolvedValue(mkStep()),
    ...over,
  }) as unknown as SequenceRepository;

const makeEntitlements = (
  over: Partial<EntitlementsService> = {},
): EntitlementsService =>
  ({
    limitsForAccount: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    limitsForBusiness: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    seatUsage: jest.fn().mockResolvedValue(1),
    ...over,
  }) as unknown as EntitlementsService;

describe("UpdateStepUseCase", () => {
  it("updates a step (no channel change)", async () => {
    const repo = makeRepo();
    const useCase = new UpdateStepUseCase(repo, makeEntitlements());

    await useCase.execute("step-1", "seq-1", "biz-1", { delayDays: 5 });
    expect(repo.updateStep).toHaveBeenCalledWith("step-1", "seq-1", "biz-1", {
      delayDays: 5,
    });
  });

  it("rejects switching a step to SMS when the plan excludes SMS", async () => {
    const repo = makeRepo();
    const useCase = new UpdateStepUseCase(
      repo,
      makeEntitlements({
        limitsForBusiness: jest.fn().mockResolvedValue(PLAN_LIMITS.starter), // sms: false
      }),
    );

    await expect(
      useCase.execute("step-1", "seq-1", "biz-1", { channel: "sms" }),
    ).rejects.toThrow(SmsNotAvailableOnPlanError);
    expect(repo.updateStep).not.toHaveBeenCalled();
  });

  it("allows switching to SMS when the plan includes SMS", async () => {
    const repo = makeRepo();
    const useCase = new UpdateStepUseCase(repo, makeEntitlements()); // growth

    await useCase.execute("step-1", "seq-1", "biz-1", { channel: "email_and_sms" });
    expect(repo.updateStep).toHaveBeenCalled();
  });
});
