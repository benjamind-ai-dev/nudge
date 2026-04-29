import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { STOPPED_REASONS, SEQUENCE_RUN_STATUSES } from "@nudge/shared";
import {
  AccountBilling,
  type BillingPlan,
  type BillingStatus,
} from "../domain/account-billing.entity";
import type {
  AccountBillingRepository,
  UpdateBillingStateParams,
} from "../domain/account-billing.repository";

@Injectable()
export class PrismaAccountBillingRepository implements AccountBillingRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByStripeCustomerId(
    customerId: string,
  ): Promise<AccountBilling | null> {
    const row = await this.prisma.account.findFirst({
      where: { stripeCustomerId: customerId },
      include: { _count: { select: { businesses: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<AccountBilling | null> {
    const row = await this.prisma.account.findFirst({
      where: { email },
      include: { _count: { select: { businesses: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(accountId: string): Promise<AccountBilling | null> {
    const row = await this.prisma.account.findFirst({
      where: { id: accountId },
      include: { _count: { select: { businesses: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByClerkId(clerkId: string): Promise<AccountBilling | null> {
    const row = await this.prisma.account.findUnique({
      where: { clerkId },
      include: { _count: { select: { businesses: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async updateBillingState(
    accountId: string,
    params: UpdateBillingStateParams,
  ): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(params.stripeCustomerId !== undefined && {
          stripeCustomerId: params.stripeCustomerId,
        }),
        ...(params.stripeSubscriptionId !== undefined && {
          stripeSubscriptionId: params.stripeSubscriptionId,
        }),
        ...(params.plan !== undefined && { plan: params.plan }),
        ...(params.status !== undefined && { status: params.status }),
        ...(params.maxBusinesses !== undefined && {
          maxBusinesses: params.maxBusinesses,
        }),
      },
    });
  }

  async stopAllActiveSequenceRuns(accountId: string): Promise<number> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: {
        status: {
          in: [SEQUENCE_RUN_STATUSES.ACTIVE, SEQUENCE_RUN_STATUSES.PAUSED],
        },
        sequence: {
          business: { accountId },
        },
      },
      data: {
        status: SEQUENCE_RUN_STATUSES.STOPPED,
        stoppedReason: STOPPED_REASONS.SUBSCRIPTION_CANCELLED,
        completedAt: new Date(),
      },
    });

    return result.count;
  }

  private toDomain(row: {
    id: string;
    email: string;
    plan: string | null;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    maxBusinesses: number;
    _count: { businesses: number };
  }): AccountBilling {
    return new AccountBilling(
      row.id,
      row.email,
      row.plan ? (row.plan as BillingPlan) : null,
      row.status as BillingStatus,
      row.stripeCustomerId,
      row.stripeSubscriptionId,
      row.maxBusinesses,
      row._count.businesses,
    );
  }
}
