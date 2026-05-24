import { Inject, Injectable } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";

export interface CreateTemplateInput {
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
}

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  execute(input: CreateTemplateInput): Promise<Template> {
    return this.repo.create(input);
  }
}
