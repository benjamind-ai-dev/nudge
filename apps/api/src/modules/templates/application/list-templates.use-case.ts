import { Inject, Injectable } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
  type TemplateWithUsage,
} from "../domain/template.repository";

export interface ListTemplatesInput {
  businessId: string;
}

@Injectable()
export class ListTemplatesUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  execute(input: ListTemplatesInput): Promise<TemplateWithUsage[]> {
    return this.repo.list(input.businessId);
  }
}
