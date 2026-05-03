import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  ActiveRunForCustomer,
  ResendEventsCustomerRepository,
} from "../domain/resend-events-customer.repository";

@Injectable()
export class PrismaResendEventsCustomerRepository
  implements ResendEventsCustomerRepository
{
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findActiveRunsByContactEmail(email: string): Promise<ActiveRunForCustomer[]> {
    const runs = await this.prisma.sequenceRun.findMany({
      where: {
        status: "active",
        invoice: {
          customer: { contactEmail: email },
        },
      },
      select: {
        id: true,
        invoice: {
          select: {
            businessId: true,
            customer: { select: { companyName: true } },
          },
        },
      },
    });

    return runs.map((run) => ({
      runId: run.id,
      businessId: run.invoice.businessId,
      companyName: run.invoice.customer.companyName,
    }));
  }
}
