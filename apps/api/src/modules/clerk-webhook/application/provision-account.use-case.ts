import { Inject, Injectable } from "@nestjs/common";
import {
  AccountProvisionRepository,
  ACCOUNT_PROVISION_REPOSITORY,
} from "../domain/account-provision.repository";

const TRIAL_DAYS = 14;

@Injectable()
export class ProvisionAccountUseCase {
  constructor(
    @Inject(ACCOUNT_PROVISION_REPOSITORY)
    private readonly repo: AccountProvisionRepository,
  ) {}

  async execute(clerkId: string, email: string, name: string): Promise<void> {
    const existing = await this.repo.findByClerkId(clerkId);
    if (existing) return;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    await this.repo.create({
      clerkId,
      email,
      name: name.trim() || email.split("@")[0],
      plan: null,
      status: "trial",
      maxBusinesses: 1,
      trialEndsAt,
    });
  }
}
