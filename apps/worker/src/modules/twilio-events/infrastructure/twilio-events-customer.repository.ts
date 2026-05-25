import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  ActiveRunForCustomer,
  TwilioEventsCustomerRepository,
} from "../domain/twilio-events.repositories";

interface ActiveRunRow {
  run_id: string;
  business_id: string;
  company_name: string;
}

@Injectable()
export class PrismaTwilioEventsCustomerRepository
  implements TwilioEventsCustomerRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  // Scopes inbound replies to the business that previously sent SMS to this
  // number — without this join, a reply to the shared Twilio number could
  // stop runs in any tenant that happens to have a customer with the same
  // digits. Matches on full-digit equality OR last-10-digit suffix, which
  // handles E.164-vs-national-format mismatches in stored contact_phone
  // (e.g., '(555) 123-4567' vs Twilio's '+15551234567').
  async findActiveRunsByContactPhone(
    phoneDigits: string,
  ): Promise<ActiveRunForCustomer[]> {
    if (!phoneDigits) return [];

    const suffix = phoneDigits.slice(-10);

    const rows = await this.prisma.$queryRaw<ActiveRunRow[]>(Prisma.sql`
      SELECT DISTINCT
             sr.id AS run_id,
             m.business_id AS business_id,
             c.company_name AS company_name
      FROM messages m
      JOIN sequence_runs sr ON sr.id = m.sequence_run_id
      JOIN customers c ON c.id = m.customer_id
      WHERE m.channel = 'sms'
        AND m.recipient_phone IS NOT NULL
        AND sr.status = 'active'
        AND (
          regexp_replace(m.recipient_phone, '[^0-9]', '', 'g') = ${phoneDigits}
          OR right(regexp_replace(m.recipient_phone, '[^0-9]', '', 'g'), 10) = ${suffix}
        )
    `);

    return rows.map((row) => ({
      runId: row.run_id,
      businessId: row.business_id,
      companyName: row.company_name,
    }));
  }
}
