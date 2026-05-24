import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  TEMPLATE_CUSTOMER_VERIFIER,
  type TemplateRepository,
  type TemplateCustomerVerifier,
} from "../domain/template.repository";

export interface AttachTemplateToCustomerInput {
  templateId: string;
  customerId: string;
  businessId: string;
}

@Injectable()
export class AttachTemplateToCustomerUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
    @Inject(TEMPLATE_CUSTOMER_VERIFIER)
    private readonly customers: TemplateCustomerVerifier,
  ) {}

  async execute(input: AttachTemplateToCustomerInput): Promise<void> {
    const tpl = await this.repo.findById(input.templateId, input.businessId);
    if (!tpl) {
      throw new NotFoundException(`Template ${input.templateId} not found`);
    }
    const customerOk = await this.customers.customerExistsInBusiness(
      input.customerId,
      input.businessId,
    );
    if (!customerOk) {
      throw new NotFoundException(`Customer ${input.customerId} not found`);
    }
    await this.repo.attachToCustomer(
      input.templateId,
      input.customerId,
      input.businessId,
    );
  }
}
