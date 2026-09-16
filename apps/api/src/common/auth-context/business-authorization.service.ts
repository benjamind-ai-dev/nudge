import { Inject, Injectable } from "@nestjs/common";
import { isAccountEntitled } from "@nudge/database";
import { BusinessNotFoundError } from "../../modules/business/domain/business.errors";
import { CallerContextService } from "./caller-context.service";
import {
  BUSINESS_OWNERSHIP_REPOSITORY,
  type BusinessOwnershipRepository,
} from "./business-ownership.repository";
import {
  AccountNotEntitledError,
  CallerNotProvisionedError,
} from "./business-authorization.errors";

@Injectable()
export class BusinessAuthorizationService {
  constructor(
    private readonly callerCtx: CallerContextService,
    @Inject(BUSINESS_OWNERSHIP_REPOSITORY)
    private readonly repo: BusinessOwnershipRepository,
  ) {}

  /**
   * Caller must (1) be provisioned, (2) own a live (not soft-deleted)
   * business, and (3) belong to a paid account. Soft-deleted and foreign
   * businesses both surface as 404 so existence isn't leaked.
   */
  async assertCallerOwnsBusiness(
    clerkUserId: string,
    businessId: string,
  ): Promise<void> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new CallerNotProvisionedError(clerkUserId);
    }
    const ownership = await this.repo.findForAccount(businessId, caller.accountId);
    if (!ownership || !ownership.isActive) {
      throw new BusinessNotFoundError(businessId);
    }
    if (!isAccountEntitled(ownership.accountStatus)) {
      throw new AccountNotEntitledError(ownership.accountStatus);
    }
  }
}
