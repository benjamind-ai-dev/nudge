import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
  type UpdateTemplateInput,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";

export interface ExecuteUpdateTemplateInput {
  id: string;
  businessId: string;
  patch: UpdateTemplateInput;
}

@Injectable()
export class UpdateTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  async execute(input: ExecuteUpdateTemplateInput): Promise<Template> {
    const updated = await this.repo.update(input.id, input.businessId, input.patch);
    if (!updated) {
      throw new NotFoundException(`Template ${input.id} not found`);
    }
    return updated;
  }
}
