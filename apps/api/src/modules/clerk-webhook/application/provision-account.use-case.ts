import { addDays } from "date-fns";
import { Inject, Injectable } from "@nestjs/common";
import {
  AccountProvisionRepository,
  ACCOUNT_PROVISION_REPOSITORY,
} from "../domain/account-provision.repository";
import {
  CLERK_ORGANIZATION_SERVICE,
  type ClerkOrganizationService,
} from "../../users/domain/clerk-organization.service";

const TRIAL_DAYS = 14;

@Injectable()
export class ProvisionAccountUseCase {
  constructor(
    @Inject(ACCOUNT_PROVISION_REPOSITORY)
    private readonly repo: AccountProvisionRepository,
    @Inject(CLERK_ORGANIZATION_SERVICE)
    private readonly orgs: ClerkOrganizationService,
  ) {}

  async execute(clerkId: string, email: string, name: string): Promise<void> {
    const existing = await this.repo.findByClerkId(clerkId);
    if (existing) return;

    const displayName = name.trim() || email.split("@")[0];
    const trialEndsAt = addDays(new Date(), TRIAL_DAYS);

    // Eager Clerk Org create. If this throws, controller returns non-2xx and Svix retries.
    const { clerkOrganizationId } = await this.orgs.createOrganization({
      name: displayName,
      ownerClerkUserId: clerkId,
    });

    await this.repo.create({
      clerkId,
      clerkOrganizationId,
      email,
      name: displayName,
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt,
    });
  }
}
