import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { TEMPLATE_SERVICE, type TemplateService } from "../../../common/template/template.service";
import { TEMPLATE_REPOSITORY, type TemplateRepository } from "../../templates/domain/template.repository";
import { SequenceNotFoundError, SequenceStepNotFoundError } from "../domain/sequence.errors";

export interface PreviewStepResult {
  subject: string;
  body: string;
}

@Injectable()
export class PreviewStepUseCase {
  constructor(
    @Inject(SEQUENCE_REPOSITORY) private readonly repo: SequenceRepository,
    @Inject(TEMPLATE_SERVICE) private readonly templates: TemplateService,
    @Inject(TEMPLATE_REPOSITORY) private readonly templateRepo: TemplateRepository,
  ) {}

  async execute(sequenceId: string, stepId: string, businessId: string): Promise<PreviewStepResult> {
    const sequence = await this.repo.findById(sequenceId, businessId);
    if (!sequence) {
      throw new SequenceNotFoundError(sequenceId);
    }

    const step = sequence.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new SequenceStepNotFoundError(stepId);
    }

    const senderName = await this.repo.findSenderName(businessId);

    let subjectSource = step.subjectTemplate ?? "";
    let bodySource = step.bodyTemplate;
    if (step.templateId) {
      const tmpl = await this.templateRepo.findById(step.templateId, businessId);
      if (tmpl) {
        subjectSource = tmpl.subject ?? "";
        bodySource = tmpl.body;
      }
    }

    const sampleData: Record<string, string> = {
      company_name: "Acme Corp",
      contact_name: "Jane Smith",
      invoice_number: "INV-0001",
      amount: "$5,000.00",
      balance_due: "$5,000.00",
      due_date: "March 15, 2026",
      days_overdue: "14",
      payment_link: "https://pay.example.com/sample",
      sender_name: senderName ?? "Your Team",
    };

    const subject = this.templates.render(
      `step:${stepId}:subject`,
      subjectSource,
      sampleData,
    );

    const body = this.templates.render(
      `step:${stepId}:body`,
      bodySource,
      sampleData,
    );

    return { subject, body };
  }
}
