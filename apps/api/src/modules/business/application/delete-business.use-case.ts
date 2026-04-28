import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
} from "../domain/business.repository";
import { BusinessNotFoundError } from "../domain/business.errors";

@Injectable()
export class DeleteBusinessUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new BusinessNotFoundError(id);
    }
    await this.repo.softDelete(id);
  }
}
