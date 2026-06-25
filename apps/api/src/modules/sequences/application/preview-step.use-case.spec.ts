import { PreviewStepUseCase } from "./preview-step.use-case";
import type { SequenceRepository } from "../domain/sequence.repository";
import type { SequenceWithSteps, SequenceStep } from "../domain/sequence.entity";
import type { TemplateService } from "../../../common/template/template.service";
import type { TemplateRepository } from "../../templates/domain/template.repository";

const mkStep = (over: Partial<SequenceStep> = {}): SequenceStep => ({
  id: "step-1",
  templateId: null,
  stepOrder: 1,
  delayDays: 3,
  channel: "email",
  subjectTemplate: "Hello {{contact_name}}",
  bodyTemplate: "Dear {{contact_name}}, your invoice {{invoice_number}} is due.",
  smsBodyTemplate: null,
  isOwnerAlert: false,
  includePaymentLink: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const mkWithSteps = (over: Partial<SequenceWithSteps> = {}): SequenceWithSteps => ({
  id: "seq-1",
  businessId: "biz-1",
  name: "Follow-Up",
  isActive: true,
  stepCount: 1,
  activeRuns: 0,
  inUse: false,
  inUseReason: null,
  relationshipTier: null,
  steps: [mkStep()],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const createMockRepo = (overrides: Partial<SequenceRepository> = {}): SequenceRepository => ({
  findAllByBusiness: jest.fn(),
  findById: jest.fn().mockResolvedValue(mkWithSteps()),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  isReferencedByTierOrCustomer: jest.fn(),
  hasRuns: jest.fn().mockResolvedValue(false),
  addStep: jest.fn(),
  updateStep: jest.fn(),
  deleteStep: jest.fn(),
  reorderSteps: jest.fn(),
  countActiveRuns: jest.fn(),
  countByBusiness: jest.fn(),
  createWithSteps: jest.fn(),
  replaceSteps: jest.fn(),
  findSenderName: jest.fn().mockResolvedValue("Acme Sender"),
  ...overrides,
});

const createMockTemplateService = (): TemplateService => ({
  render: jest.fn().mockImplementation((_key: string, template: string) => template),
});

const createMockTemplateRepo = (overrides: Partial<TemplateRepository> = {}): TemplateRepository => ({
  list: jest.fn(),
  findById: jest.fn().mockResolvedValue(null),
  isInUse: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  attachToCustomer: jest.fn(),
  detachFromCustomer: jest.fn(),
  ...overrides,
});

describe("PreviewStepUseCase", () => {
  it("renders subject and body with sample data and real sender_name", async () => {
    const templateService: TemplateService = {
      render: jest.fn()
        .mockReturnValueOnce("Rendered Subject")
        .mockReturnValueOnce("Rendered Body"),
    };
    const repo = createMockRepo();
    const templateRepo = createMockTemplateRepo();
    const useCase = new PreviewStepUseCase(repo, templateService, templateRepo);

    const result = await useCase.execute("seq-1", "step-1", "biz-1");

    expect(result).toEqual({ subject: "Rendered Subject", body: "Rendered Body" });
    expect(templateService.render).toHaveBeenCalledTimes(2);
    expect(templateService.render).toHaveBeenCalledWith(
      "step:step-1:subject",
      "Hello {{contact_name}}",
      expect.objectContaining({ sender_name: "Acme Sender" }),
    );
  });

  it("returns unknown template variables literally (not blank)", async () => {
    const realTemplateService: TemplateService = {
      render: jest.fn().mockImplementation((_key: string, template: string, data: Record<string, string>) => {
        // Simulate proxy behavior: missing keys appear as {{key}}
        return template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
          return key in data ? data[key] : `{{${key}}}`;
        });
      }),
    };
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue(
        mkWithSteps({
          steps: [mkStep({ subjectTemplate: "Hello {{unknown_var}}", bodyTemplate: "Body" })],
        }),
      ),
    });
    const templateRepo = createMockTemplateRepo();
    const useCase = new PreviewStepUseCase(repo, realTemplateService, templateRepo);

    const result = await useCase.execute("seq-1", "step-1", "biz-1");

    expect(result.subject).toBe("Hello {{unknown_var}}");
  });

  it("uses the real sender_name from business", async () => {
    const templateService = createMockTemplateService();
    const repo = createMockRepo({
      findSenderName: jest.fn().mockResolvedValue("Custom Sender Name"),
    });
    const templateRepo = createMockTemplateRepo();
    const useCase = new PreviewStepUseCase(repo, templateService, templateRepo);

    await useCase.execute("seq-1", "step-1", "biz-1");

    expect(templateService.render).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ sender_name: "Custom Sender Name" }),
    );
  });

  it("renders from the attached template when the step has a templateId", async () => {
    const repo = createMockRepo({
      findById: jest.fn().mockResolvedValue({
        id: "seq-1",
        steps: [{ id: "step-1", templateId: "tmpl-1", subjectTemplate: "INLINE", bodyTemplate: "inline body" }],
      } as never),
      findSenderName: jest.fn().mockResolvedValue("Acme"),
    });
    const templateRepo = createMockTemplateRepo({
      findById: jest.fn().mockResolvedValue({
        id: "tmpl-1", subject: "Invoice {{invoice_number}}", body: "Hi {{contact_name}}",
      } as never),
    });
    const templateService: TemplateService = {
      render: jest.fn().mockImplementation((_key: string, template: string, data: Record<string, string>) => {
        return template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
          return key in data ? data[key] : `{{${key}}}`;
        });
      }),
    };
    const useCase = new PreviewStepUseCase(repo, templateService, templateRepo);

    const result = await useCase.execute("seq-1", "step-1", "biz-1");

    expect(result.subject).toContain("INV-0001"); // from template, not "INLINE"
    expect(templateRepo.findById).toHaveBeenCalledWith("tmpl-1", "biz-1");
  });
});
