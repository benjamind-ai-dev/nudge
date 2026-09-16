import { Inject, Injectable } from "@nestjs/common";
import { type PrismaClient, entitledBusinessWhere } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  BusinessWithOwner,
  ResendEventsBusinessRepository,
} from "../domain/resend-events-business.repository";

@Injectable()
export class PrismaResendEventsBusinessRepository
  implements ResendEventsBusinessRepository
{
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findWithOwner(businessId: string): Promise<BusinessWithOwner | null> {
    // null for deleted businesses / unpaid accounts → no owner alert is sent.
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ...entitledBusinessWhere() },
      select: {
        name: true,
        account: { select: { email: true } },
      },
    });

    if (!business) return null;

    return {
      name: business.name,
      ownerEmail: business.account.email,
    };
  }
}
