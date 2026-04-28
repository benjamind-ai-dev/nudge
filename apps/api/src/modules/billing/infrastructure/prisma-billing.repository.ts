import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { type BillingRepository } from "../domain/billing.repository";
import {
  BillingAccount,
  BillingPlan,
  BillingStatus,
} from "../domain/billing.entity";

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByAccountId(accountId: string): Promise<BillingAccount | null> {
    const row = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        plan: true,
        status: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        trialEndsAt: true,
      },
    });

    if (!row) return null;

    return new BillingAccount(
      row.id,
      (row.plan as BillingPlan) || null,
      row.status as BillingStatus,
      row.stripeCustomerId,
      row.stripeSubscriptionId,
      row.trialEndsAt,
    );
  }

  async updateStripeCustomerId(
    accountId: string,
    customerId: string,
  ): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { stripeCustomerId: customerId },
    });
  }
}
