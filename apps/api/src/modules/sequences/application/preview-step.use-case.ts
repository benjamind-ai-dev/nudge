import { Inject, Injectable } from "@nestjs/common";
import { SEQUENCE_REPOSITORY, type SequenceRepository } from "../domain/sequence.repository";
import { TEMPLATE_SERVICE, type TemplateService } from "../../../common/template/template.service";
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
      step.subjectTemplate ?? "",
      sampleData,
    );

    const body = this.templates.render(
      `step:${stepId}:body`,
      step.bodyTemplate,
      sampleData,
    );

    return { subject, body };
  }
}
