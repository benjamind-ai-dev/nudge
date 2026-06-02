import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { limitsForPlan, type BillingPlan, type PlanLimits } from "@nudge/shared";
import { PRISMA_CLIENT } from "../database/database.module";

/**
 * Resolves per-plan entitlement limits + current usage for an account/business.
 * Pure data — callers (use cases) perform the check and throw their own domain
 * errors. Lives in `common/` so it may read Prisma directly.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async limitsForAccount(accountId: string): Promise<PlanLimits> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    });
    return limitsForPlan(account?.plan as BillingPlan | null);
  }

  async limitsForBusiness(businessId: string): Promise<PlanLimits> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { account: { select: { plan: true } } },
    });
    return limitsForPlan(business?.account.plan as BillingPlan | null);
  }

  /** Active + pending team members on the account (owner counts). */
  async seatUsage(accountId: string): Promise<number> {
    return this.prisma.user.count({ where: { accountId } });
  }
}
