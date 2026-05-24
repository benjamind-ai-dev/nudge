import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";

export interface GetTemplateInput {
  id: string;
  businessId: string;
}

@Injectable()
export class GetTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  async execute(input: GetTemplateInput): Promise<Template> {
    const tpl = await this.repo.findById(input.id, input.businessId);
    if (!tpl) {
      throw new NotFoundException(`Template ${input.id} not found`);
    }
    return tpl;
  }
}
