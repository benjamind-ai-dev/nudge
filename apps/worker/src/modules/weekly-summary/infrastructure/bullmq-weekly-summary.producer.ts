import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "@nudge/shared";
import {
  WEEKLY_SUMMARY_REPOSITORY,
  type WeeklySummaryRepository,
} from "../domain/weekly-summary.repository";
import type { WeeklySummaryQueueProducer } from "../application/dispatch-weekly-summaries.use-case";

@Injectable()
export class BullmqWeeklySummaryProducer implements WeeklySummaryQueueProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.WEEKLY_SUMMARY)
    private readonly queue: Queue,
    @Inject(WEEKLY_SUMMARY_REPOSITORY)
    private readonly repo: WeeklySummaryRepository,
  ) {}

  async enqueueBusiness(input: { businessId: string; weekStartsAt: string }): Promise<void> {
    await this.queue.add(JOB_NAMES.WEEKLY_SUMMARY_BUSINESS, input, {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
      jobId: `weekly-summary:${input.businessId}:${input.weekStartsAt}`,
    });
  }

  summaryExists(businessId: string, weekStartsAt: string): Promise<boolean> {
    return this.repo.exists(businessId, weekStartsAt);
  }
}
