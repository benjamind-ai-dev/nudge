import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";

@Injectable()
export class RepeatableJobsService implements OnModuleInit {
  private readonly logger = new Logger(RepeatableJobsService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly invoiceSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEQUENCE_TRIGGER)
    private readonly sequenceTriggerQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MESSAGE_SEND)
    private readonly messageSendQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TOKEN_REFRESH)
    private readonly tokenRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DAYS_RECALC)
    private readonly daysRecalcQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.invoiceSyncQueue.upsertJobScheduler(
      "invoice-sync-scheduler",
      { every: 900_000 },
      { name: "invoice-sync-tick" },
    );
    this.logger.log("Registered invoice-sync: every 15 minutes");

    await this.sequenceTriggerQueue.upsertJobScheduler(
      "sequence-trigger-scheduler",
      { every: 300_000 },
      { name: "sequence-trigger-tick" },
    );
    this.logger.log("Registered sequence-trigger: every 5 minutes");

    await this.messageSendQueue.upsertJobScheduler(
      "message-send-scheduler",
      { every: 60_000 },
      { name: "message-send-tick" },
    );
    this.logger.log("Registered message-send: every 1 minute");

    await this.tokenRefreshQueue.upsertJobScheduler(
      "token-refresh-scheduler",
      { every: 1_800_000 },
      { name: "token-refresh-tick" },
    );
    this.logger.log("Registered token-refresh: every 30 minutes");

    await this.daysRecalcQueue.upsertJobScheduler(
      "days-recalc-scheduler",
      { pattern: "0 0 * * *" },
      { name: "days-recalc-tick" },
    );
    this.logger.log("Registered days-recalc: daily at midnight UTC");

    this.logger.log("All repeatable jobs registered");
  }
}
