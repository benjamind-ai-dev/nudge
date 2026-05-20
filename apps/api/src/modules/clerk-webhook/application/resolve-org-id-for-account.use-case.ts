import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_PROVISION_REPOSITORY,
  type AccountProvisionRepository,
} from "../domain/account-provision.repository";
import {
  CLERK_ORGANIZATION_SERVICE,
  type ClerkOrganizationService,
} from "../../users/domain/clerk-organization.service";

@Injectable()
export class ResolveOrgIdForAccountUseCase {
  private readonly logger = new Logger(ResolveOrgIdForAccountUseCase.name);

  constructor(
    @Inject(ACCOUNT_PROVISION_REPOSITORY)
    private readonly repo: AccountProvisionRepository,
    @Inject(CLERK_ORGANIZATION_SERVICE)
    private readonly orgs: ClerkOrganizationService,
  ) {}

  async execute(accountId: string): Promise<string> {
    const account = await this.repo.findAccountForOrgResolution(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    if (account.clerkOrganizationId) {
      return account.clerkOrganizationId;
    }
    if (!account.ownerClerkUserId) {
      throw new Error(
        `Cannot lazy-create Clerk Org for account ${accountId}: owner clerk user id is not set`,
      );
    }

    const { clerkOrganizationId } = await this.orgs.createOrganization({
      name: account.accountName,
      ownerClerkUserId: account.ownerClerkUserId,
    });
    await this.repo.setClerkOrganizationId(accountId, clerkOrganizationId);

    this.logger.log({
      msg: "Lazy-created Clerk Org for legacy account",
      event: "clerk_org_lazy_created",
      accountId,
      clerkOrganizationId,
    });

    return clerkOrganizationId;
  }
}
