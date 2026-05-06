import { Inject, Injectable, Logger } from "@nestjs/common";

export interface DispatchClock {
  now(): Date;
}

export const DISPATCH_CLOCK = Symbol("DISPATCH_CLOCK");

export interface BusinessForDispatch {
  id: string;
  timezone: string;
}

export interface BusinessTimezoneReader {
  listAll(): Promise<BusinessForDispatch[]>;
}

export const BUSINESS_TIMEZONE_READER = Symbol("BUSINESS_TIMEZONE_READER");

export interface WeeklySummaryQueueProducer {
  enqueueBusiness(input: { businessId: string; weekStartsAt: string }): Promise<void>;
  summaryExists(businessId: string, weekStartsAt: string): Promise<boolean>;
}

export const WEEKLY_SUMMARY_PRODUCER = Symbol("WEEKLY_SUMMARY_PRODUCER");

interface LocalParts {
  weekday: number; // 1=Monday ... 7=Sunday
  hour: number;
  yearMonthDay: string;
}

function getLocalParts(now: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    weekday: weekdayMap[parts.weekday as string] ?? 0,
    hour: parseInt(parts.hour as string, 10),
    yearMonthDay: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

@Injectable()
export class DispatchWeeklySummariesUseCase {
  private readonly logger = new Logger(DispatchWeeklySummariesUseCase.name);

  constructor(
    @Inject(DISPATCH_CLOCK) private readonly clock: DispatchClock,
    @Inject(BUSINESS_TIMEZONE_READER) private readonly reader: BusinessTimezoneReader,
    @Inject(WEEKLY_SUMMARY_PRODUCER) private readonly producer: WeeklySummaryQueueProducer,
  ) {}

  async execute(): Promise<{ enqueued: number; skipped: number; total: number }> {
    const now = this.clock.now();
    const businesses = await this.reader.listAll();

    let enqueued = 0;
    let skipped = 0;

    for (const b of businesses) {
      let local: LocalParts;
      try {
        local = getLocalParts(now, b.timezone);
      } catch {
        this.logger.warn({ msg: "Skipping business with bad timezone", businessId: b.id, timezone: b.timezone });
        continue;
      }

      const inWindow = local.weekday === 1 && (local.hour === 8 || local.hour === 9 || local.hour === 10);
      if (!inWindow) continue;

      const exists = await this.producer.summaryExists(b.id, local.yearMonthDay);
      if (exists) {
        skipped += 1;
        continue;
      }

      await this.producer.enqueueBusiness({ businessId: b.id, weekStartsAt: local.yearMonthDay });
      enqueued += 1;
    }

    this.logger.log({
      msg: "Weekly summary dispatch completed",
      event: "weekly_summary_dispatch",
      enqueued,
      skipped,
      total: businesses.length,
    });

    return { enqueued, skipped, total: businesses.length };
  }
}
