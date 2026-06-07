import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type BusinessWithConnections,
  type CreateBusinessData,
} from "../domain/business.repository";
import { ACCOUNT_READER, type AccountReader } from "../domain/account-reader";
import {
  AccountNotFoundError,
  BusinessLimitReachedError,
} from "../domain/business.errors";
import { CreateDefaultTemplateUseCase } from "../../templates/application/create-default-template.use-case";

@Injectable()
export class CreateBusinessUseCase {
  private readonly logger = new Logger(CreateBusinessUseCase.name);

  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly repo: BusinessRepository,
    @Inject(ACCOUNT_READER)
    private readonly accounts: AccountReader,
    private readonly defaultTemplate: CreateDefaultTemplateUseCase,
  ) {}

  async execute(data: CreateBusinessData): Promise<BusinessWithConnections> {
    const account = await this.accounts.findById(data.accountId);
    if (!account) {
      throw new AccountNotFoundError(data.accountId);
    }

    const existing = await this.repo.countByAccountId(data.accountId);
    if (existing >= account.maxBusinesses) {
      throw new BusinessLimitReachedError(data.accountId, account.maxBusinesses);
    }

    const business = await this.repo.create({
      ...data,
      senderEmail: data.senderEmail ?? account.email,
    });

    try {
      await this.defaultTemplate.execute({ businessId: business.id });
    } catch (err) {
      // Default-template seeding failure must not block business creation.
      this.logger.error({
        msg: "Default template seeding failed; business created without one",
        event: "default_template_seed_failed",
        businessId: business.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return business;
  }
}
