import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type BusinessWithConnections,
  type CreateBusinessData,
} from "../domain/business.repository";

@Injectable()
export class CreateBusinessUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
  ) {}

  async execute(data: CreateBusinessData): Promise<BusinessWithConnections> {
    return this.repo.create(data);
  }
}
