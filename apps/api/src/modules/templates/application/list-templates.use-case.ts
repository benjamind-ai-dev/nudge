import { Inject, Injectable } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";

export interface ListTemplatesInput {
  businessId: string;
}

@Injectable()
export class ListTemplatesUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  execute(input: ListTemplatesInput): Promise<Template[]> {
    return this.repo.list(input.businessId);
  }
}
