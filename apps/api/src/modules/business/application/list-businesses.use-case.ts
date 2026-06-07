import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type BusinessWithConnections,
} from "../domain/business.repository";

@Injectable()
export class ListBusinessesUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
  ) {}

  async execute(accountId: string): Promise<BusinessWithConnections[]> {
    return this.repo.findByAccountId(accountId);
  }
}
