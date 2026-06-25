import { PLAN_LIMITS } from "@nudge/shared";
import { AddStepUseCase } from "./add-step.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { SequenceWithSteps, SequenceStep } from "../domain/sequence.entity";
import { StepLimitReachedError, SmsNotAvailableOnPlanError, TemplateNotInBusinessError, SequenceHasActiveRunsError } from "../domain/sequence.errors";
import type { EntitlementsService } from "../../../common/entitlements/entitlements.service";
import type { TemplateRepository } from "../../templates/domain/template.repository";

const makeEntitlements = (
  over: Partial<EntitlementsService> = {},
): EntitlementsService =>
  ({
    limitsForAccount: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    limitsForBusiness: jest.fn().mockResolvedValue(PLAN_LIMITS.growth),
    seatUsage: jest.fn().mockResolvedValue(1),
    ...over,
  }) as unknown as EntitlementsService;

const mkStep = (over: Partial<SequenceStep> = {}): SequenceStep => ({
  id: "step-1",
  templateId: null,
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

const mkWithSteps = (steps: SequenceStep[]): SequenceWithSteps => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  isActive: true,
  stepCount: steps.length,
  activeRuns: 0,
  relationshipTier: null,
  steps,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

const createMockTemplateRepo = (over: Partial<TemplateRepository> = {}): TemplateRepository =>
  ({
    findById: jest.fn().mockResolvedValue({ id: "tmpl-1" }),
    ...over,
  }) as unknown as TemplateRepository;

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn().mockResolvedValue(mkWithSteps([])),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn(),
  hasRuns: jest.fn().mockResolvedValue(false),
  addStep: jest.fn().mockResolvedValue(mkStep()),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  countActiveRuns: jest.fn().mockResolvedValue(0),
  countByBusiness: jest.fn().mockResolvedValue(0),
  replaceSteps: jest.fn(),
  findSenderName: jest.fn().mockResolvedValue("Sender"),
  createWithSteps: jest.fn(),
  ...overrides,
});

describe("AddStepUseCase", () => {
  it("adds a step when the sequence has fewer than 10 steps", async () => {
    const existing = Array.from({ length: 3 }, (_, i) => mkStep({ id: `s-${i}`, stepOrder: i + 1 }));
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue(mkWithSteps(existing)),
    });
    const useCase = new AddStepUseCase(repo, makeEntitlements(), createMockTemplateRepo());

    const result = await useCase.execute("seq-1", "biz-1", {
      stepOrder: 4,
      delayDays: 1,
      channel: "email",
      bodyTemplate: "Body",
    });

    expect(repo.addStep).toHaveBeenCalledWith("seq-1", "biz-1", expect.objectContaining({ stepOrder: 4 }));
    expect(result).toMatchObject({ id: "step-1" });
  });

  it("rejects with StepLimitReachedError when sequence already has 10 steps", async () => {
    const existing = Array.from({ length: 10 }, (_, i) => mkStep({ id: `s-${i}`, stepOrder: i + 1 }));
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue(mkWithSteps(existing)),
    });
    const useCase = new AddStepUseCase(repo, makeEntitlements(), createMockTemplateRepo());

    await expect(
      useCase.execute("seq-1", "biz-1", {
        stepOrder: 11,
        delayDays: 1,
        channel: "email",
        bodyTemplate: "Body",
      }),
    ).rejects.toThrow(StepLimitReachedError);
  });

  it("rejects an SMS step when the plan does not include SMS", async () => {
    const repo = createMockRepo();
    const useCase = new AddStepUseCase(
      repo,
      makeEntitlements({
        limitsForBusiness: jest.fn().mockResolvedValue(PLAN_LIMITS.starter), // sms: false
      }),
      createMockTemplateRepo(),
    );

    await expect(
      useCase.execute("seq-1", "biz-1", {
        stepOrder: 1,
        delayDays: 1,
        channel: "email_and_sms",
        bodyTemplate: "Body",
      }),
    ).rejects.toThrow(SmsNotAvailableOnPlanError);
    expect(repo.addStep).not.toHaveBeenCalled();
  });

  it("allows an SMS step when the plan includes SMS", async () => {
    const repo = createMockRepo();
    const useCase = new AddStepUseCase(repo, makeEntitlements(), createMockTemplateRepo()); // growth, sms: true

    await useCase.execute("seq-1", "biz-1", {
      stepOrder: 1,
      delayDays: 1,
      channel: "sms",
      bodyTemplate: "Body",
    });
    expect(repo.addStep).toHaveBeenCalled();
  });

  it("throws TemplateNotInBusinessError when templateId is not in the business", async () => {
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue({ id: "seq-1", steps: [], businessId: "biz-1" } as never),
    });
    const templateRepo = createMockTemplateRepo({
      findById: jest.fn().mockResolvedValue(null), // not found in business
    });
    const useCase = new AddStepUseCase(repo, makeEntitlements(), templateRepo);

    await expect(
      useCase.execute("seq-1", "biz-1", {
        templateId: "tmpl-x",
        stepOrder: 1,
        delayDays: 0,
        channel: "email",
        bodyTemplate: "Hi",
      }),
    ).rejects.toThrow(TemplateNotInBusinessError);
  });

  it("throws SequenceHasActiveRunsError when the sequence has active runs", async () => {
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue({ id: "seq-1", steps: [], businessId: "biz-1" } as never),
      countActiveRuns: jest.fn().mockResolvedValue(3),
    });
    const useCase = new AddStepUseCase(repo, makeEntitlements(), createMockTemplateRepo());

    await expect(
      useCase.execute("seq-1", "biz-1", { stepOrder: 1, delayDays: 0, channel: "email", bodyTemplate: "Hi" }),
    ).rejects.toThrow(SequenceHasActiveRunsError);
    expect(repo.addStep).not.toHaveBeenCalled();
  });
});
