import { Inject, Injectable } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";
import type { Template } from "../domain/template.entity";
import {
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TEMPLATE_SUBJECT,
  DEFAULT_TEMPLATE_BODY,
  DEFAULT_TEMPLATE_SIGNATURE,
} from "./default-template.constants";

export interface CreateDefaultTemplateInput {
  businessId: string;
}

@Injectable()
export class CreateDefaultTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  async execute(input: CreateDefaultTemplateInput): Promise<Template> {
    return this.repo.create({
      businessId: input.businessId,
      name: DEFAULT_TEMPLATE_NAME,
      subject: DEFAULT_TEMPLATE_SUBJECT,
      body: DEFAULT_TEMPLATE_BODY,
      signature: DEFAULT_TEMPLATE_SIGNATURE,
    });
  }
}
