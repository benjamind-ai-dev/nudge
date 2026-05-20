import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  AccountProvisionRepository,
  CreateAccountParams,
} from "../domain/account-provision.repository";

@Injectable()
export class PrismaAccountProvisionRepository implements AccountProvisionRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findByClerkId(clerkId: string): Promise<{ clerkId: string } | null> {
    const row = await this.prisma.account.findUnique({
      where: { clerkId },
      select: { clerkId: true },
    });
    if (!row || !row.clerkId) return null;
    return { clerkId: row.clerkId };
  }

  async create(params: CreateAccountParams): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: params.name,
          email: params.email,
          plan: params.plan,
          status: params.status,
          maxBusinesses: params.maxBusinesses,
          clerkId: params.clerkId,
          clerkOrganizationId: params.clerkOrganizationId,
          trialEndsAt: params.trialEndsAt,
        },
      });
      await tx.user.create({
        data: {
          accountId: account.id,
          email: params.email,
          name: params.name,
          role: "owner",
          clerkUserId: params.clerkId,
        },
      });
    });
  }

  async findAccountForOrgResolution(accountId: string): Promise<{
    accountId: string;
    accountName: string;
    clerkOrganizationId: string | null;
    ownerClerkUserId: string | null;
  } | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`;
      const account = await tx.account.findUnique({ where: { id: accountId } });
      if (!account) return null;
      const owner = await tx.user.findFirst({ where: { accountId, role: "owner" } });
      return {
        accountId: account.id,
        accountName: account.name,
        clerkOrganizationId: account.clerkOrganizationId,
        ownerClerkUserId: owner?.clerkUserId ?? null,
      };
    });
  }

  async setClerkOrganizationId(accountId: string, clerkOrganizationId: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { clerkOrganizationId },
    });
  }
}
