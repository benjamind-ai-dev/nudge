import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@nudge/shared";
import { CheckDeadLetterUseCase } from "./application/check-dead-letter.use-case";
import { DeadLetterMonitorProcessor } from "./infrastructure/dead-letter-monitor.processor";
import { DiscordAlertService } from "./infrastructure/discord-alert.service";
import { ALERT_SERVICE } from "./domain/alert.service";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DEAD_LETTER_CHECK },
      { name: QUEUE_NAMES.DEAD_LETTER },
      { name: QUEUE_NAMES.MESSAGE_SEND },
      { name: QUEUE_NAMES.TOKEN_REFRESH },
      { name: QUEUE_NAMES.INVOICE_SYNC },
      { name: QUEUE_NAMES.SEQUENCE_TRIGGER },
      { name: QUEUE_NAMES.DAYS_RECALC },
    ),
  ],
  providers: [
    CheckDeadLetterUseCase,
    DeadLetterMonitorProcessor,
    {
      provide: ALERT_SERVICE,
      useClass: DiscordAlertService,
    },
  ],
})
export class DeadLetterMonitorModule implements OnModuleInit {
  private readonly logger = new Logger(DeadLetterMonitorModule.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER_CHECK)
    private readonly deadLetterCheckQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const jobName = JOB_NAMES.DEAD_LETTER_CHECK_TICK;

    const existingJobs = await this.deadLetterCheckQueue.getRepeatableJobs();
    const alreadyRegistered = existingJobs.some((j) => j.name === jobName);

    if (!alreadyRegistered) {
      await this.deadLetterCheckQueue.add(
        jobName,
        {},
        {
          repeat: {
            pattern: "0 7 * * *", // 7am UTC daily
          },
          attempts: 1,
          backoff: {
            type: "fixed",
            delay: 60_000,
          },
        },
      );

      this.logger.log({
        msg: "Registered dead letter check repeatable job",
        event: "dead_letter_check_registered",
        schedule: "0 7 * * * (7am UTC daily)",
      });
    } else {
      this.logger.debug({
        msg: "Dead letter check job already registered",
        event: "dead_letter_check_already_registered",
      });
    }
  }
}
