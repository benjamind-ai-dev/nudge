import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type BusinessWithConnections,
} from "../domain/business.repository";
import { BusinessNotFoundError } from "../domain/business.errors";

@Injectable()
export class GetBusinessUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
  ) {}

  async execute(id: string): Promise<BusinessWithConnections> {
    const business = await this.repo.findById(id);
    if (!business) {
      throw new BusinessNotFoundError(id);
    }
    return business;
  }
}
