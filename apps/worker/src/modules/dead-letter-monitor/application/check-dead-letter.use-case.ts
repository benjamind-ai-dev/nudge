import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import {
  type DeadLetterJob,
  type DeadLetterSummary,
  type StuckJob,
  calculateSeverity,
} from "../domain/dead-letter.types";
import { ALERT_SERVICE, type AlertService } from "../domain/alert.service";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export interface CheckDeadLetterResult {
  deadJobCount: number;
  stuckJobCount: number;
  alertSent: boolean;
}

@Injectable()
export class CheckDeadLetterUseCase {
  private readonly logger = new Logger(CheckDeadLetterUseCase.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetterQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MESSAGE_SEND)
    private readonly messageSendQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TOKEN_REFRESH)
    private readonly tokenRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly invoiceSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEQUENCE_TRIGGER)
    private readonly sequenceTriggerQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DAYS_RECALC)
    private readonly daysRecalcQueue: Queue,
    @Inject(ALERT_SERVICE)
    private readonly alertService: AlertService,
  ) {}

  async execute(): Promise<CheckDeadLetterResult> {
    this.logger.log({
      msg: "Checking dead letter queue",
      event: "dead_letter_check_started",
    });

    const [deadJobs, stuckJobs] = await Promise.all([
      this.getDeadJobsFromLast24Hours(),
      this.getStuckJobs(),
    ]);

    if (deadJobs.length === 0 && stuckJobs.length === 0) {
      this.logger.debug({
        msg: "No dead or stuck jobs found",
        event: "dead_letter_check_clean",
      });
      return { deadJobCount: 0, stuckJobCount: 0, alertSent: false };
    }

    const summary = this.buildSummary(deadJobs);

    this.logger.warn({
      msg: "Dead or stuck jobs found, sending alert",
      event: "dead_letter_check_alert",
      deadJobCount: deadJobs.length,
      stuckJobCount: stuckJobs.length,
      severity: summary.severity,
      byQueue: summary.byQueue,
    });

    await this.alertService.send({ summary, stuckJobs });

    return {
      deadJobCount: deadJobs.length,
      stuckJobCount: stuckJobs.length,
      alertSent: true,
    };
  }

  private async getDeadJobsFromLast24Hours(): Promise<DeadLetterJob[]> {
    const oneDayAgo = Date.now() - TWENTY_FOUR_HOURS_MS;

    const jobs = await this.deadLetterQueue.getCompleted(0, 1000);

    const recentJobs: DeadLetterJob[] = [];

    for (const job of jobs) {
      const jobData = job.data as {
        originalQueue?: string;
        originalJobId?: string;
        data?: Record<string, unknown>;
        failedReason?: string;
        failedAt?: string;
      };

      if (!jobData.failedAt) continue;

      const failedAt = new Date(jobData.failedAt).getTime();
      if (failedAt < oneDayAgo) continue;

      recentJobs.push({
        originalQueue: jobData.originalQueue ?? "unknown",
        originalJobId: jobData.originalJobId ?? job.id ?? "unknown",
        data: jobData.data ?? {},
        failedReason: jobData.failedReason ?? "Unknown error",
        failedAt: jobData.failedAt,
      });
    }

    return recentJobs;
  }

  private async getStuckJobs(): Promise<StuckJob[]> {
    const thirtyMinutesAgo = Date.now() - THIRTY_MINUTES_MS;
    const stuckJobs: StuckJob[] = [];

    const queues = [
      { queue: this.messageSendQueue, name: QUEUE_NAMES.MESSAGE_SEND },
      { queue: this.tokenRefreshQueue, name: QUEUE_NAMES.TOKEN_REFRESH },
      { queue: this.invoiceSyncQueue, name: QUEUE_NAMES.INVOICE_SYNC },
      { queue: this.sequenceTriggerQueue, name: QUEUE_NAMES.SEQUENCE_TRIGGER },
      { queue: this.daysRecalcQueue, name: QUEUE_NAMES.DAYS_RECALC },
    ];

    for (const { queue, name } of queues) {
      try {
        const activeJobs = await queue.getActive();

        for (const job of activeJobs) {
          const processedOn = job.processedOn;
          if (processedOn && processedOn < thirtyMinutesAgo) {
            stuckJobs.push({
              queue: name,
              jobId: job.id ?? "unknown",
              jobName: job.name,
              data: job.data as Record<string, unknown>,
              runningForMinutes: Math.round((Date.now() - processedOn) / 60000),
            });
          }
        }
      } catch (error) {
        this.logger.warn({
          msg: "Failed to check active jobs for queue",
          event: "stuck_job_check_error",
          queue: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return stuckJobs;
  }

  private buildSummary(jobs: DeadLetterJob[]): DeadLetterSummary {
    const byQueue: Record<string, number> = {};

    for (const job of jobs) {
      byQueue[job.originalQueue] = (byQueue[job.originalQueue] ?? 0) + 1;
    }

    return {
      totalCount: jobs.length,
      byQueue,
      jobs,
      severity: calculateSeverity(byQueue),
    };
  }
}
