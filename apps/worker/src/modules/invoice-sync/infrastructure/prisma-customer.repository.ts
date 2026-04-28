import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import type { ProviderName } from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { CanonicalCustomer } from "../domain/canonical-invoice";
import type { CustomerRepository } from "../domain/repositories";

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async upsertMany(
    businessId: string,
    provider: ProviderName,
    customers: CanonicalCustomer[],
  ): Promise<void> {
    if (customers.length === 0) return;
    const now = new Date();
    await this.prisma.$transaction(
      customers.map((c) =>
        this.prisma.customer.upsert({
          where: {
            businessId_externalId: {
              businessId,
              externalId: c.externalId,
            },
          },
          create: {
            businessId,
            externalId: c.externalId,
            provider,
            companyName: c.companyName,
            contactName: c.contactName,
            contactEmail: c.contactEmail,
            contactPhone: c.contactPhone,
            lastSyncedAt: now,
          },
          update: {
            provider,
            companyName: c.companyName,
            contactName: c.contactName,
            contactEmail: c.contactEmail,
            contactPhone: c.contactPhone,
            lastSyncedAt: now,
          },
        }),
      ),
    );
  }

  async reconcileAllTotalOutstanding(): Promise<{ updatedCount: number }> {
    const updated = await this.prisma.$executeRaw`
      UPDATE "customers" AS c
      SET "total_outstanding" = COALESCE(sub.total, 0)
      FROM (
        SELECT c2.id AS customer_id,
               COALESCE(SUM(i.balance_due_cents), 0) AS total
        FROM "customers" c2
        LEFT JOIN "invoices" i
          ON i.customer_id = c2.id
         AND i.status IN ('open', 'overdue', 'partial')
        GROUP BY c2.id
      ) AS sub
      WHERE c."id" = sub.customer_id
        AND c."total_outstanding" IS DISTINCT FROM COALESCE(sub.total, 0);
    `;
    return { updatedCount: Number(updated) };
  }

  async existsByExternalId(
    businessId: string,
    externalId: string,
  ): Promise<boolean> {
    const row = await this.prisma.customer.findFirst({
      where: { businessId, externalId },
      select: { id: true },
    });
    return row !== null;
  }
}
