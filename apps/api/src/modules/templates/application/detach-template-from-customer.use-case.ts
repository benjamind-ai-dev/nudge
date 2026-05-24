import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";

export interface DetachTemplateFromCustomerInput {
  templateId: string;
  customerId: string;
  businessId: string;
}

@Injectable()
export class DetachTemplateFromCustomerUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  async execute(input: DetachTemplateFromCustomerInput): Promise<void> {
    const tpl = await this.repo.findById(input.templateId, input.businessId);
    if (!tpl) {
      throw new NotFoundException(`Template ${input.templateId} not found`);
    }
    await this.repo.detachFromCustomer(
      input.templateId,
      input.customerId,
      input.businessId,
    );
  }
}
