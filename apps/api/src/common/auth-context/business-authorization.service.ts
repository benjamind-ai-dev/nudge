import { Inject, Injectable } from "@nestjs/common";
import { BusinessNotFoundError } from "../../modules/business/domain/business.errors";
import { CallerContextService } from "./caller-context.service";
import {
  BUSINESS_OWNERSHIP_REPOSITORY,
  type BusinessOwnershipRepository,
} from "./business-ownership.repository";
import { CallerNotProvisionedError } from "./business-authorization.errors";

@Injectable()
export class BusinessAuthorizationService {
  constructor(
    private readonly callerCtx: CallerContextService,
    @Inject(BUSINESS_OWNERSHIP_REPOSITORY)
    private readonly repo: BusinessOwnershipRepository,
  ) {}

  async assertCallerOwnsBusiness(
    clerkUserId: string,
    businessId: string,
  ): Promise<void> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new CallerNotProvisionedError(clerkUserId);
    }
    const owns = await this.repo.existsForAccount(businessId, caller.accountId);
    if (!owns) {
      throw new BusinessNotFoundError(businessId);
    }
  }
}
