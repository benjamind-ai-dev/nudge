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
    return row as { clerkId: string } | null;
  }

  async create(params: CreateAccountParams): Promise<void> {
    await this.prisma.account.create({
      data: {
        name: params.name,
        email: params.email,
        plan: params.plan ?? "",
        status: params.status,
        maxBusinesses: params.maxBusinesses,
        clerkId: params.clerkId,
        trialEndsAt: params.trialEndsAt,
      },
    });
  }
}
