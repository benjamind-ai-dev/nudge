import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../domain/template.repository";

export interface DeleteTemplateInput {
  id: string;
  businessId: string;
}

@Injectable()
export class DeleteTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly repo: TemplateRepository,
  ) {}

  async execute(input: DeleteTemplateInput): Promise<void> {
    const ok = await this.repo.delete(input.id, input.businessId);
    if (!ok) {
      throw new NotFoundException(`Template ${input.id} not found`);
    }
  }
}
