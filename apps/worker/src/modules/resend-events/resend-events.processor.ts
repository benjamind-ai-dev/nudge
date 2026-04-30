import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type ResendEventsJobData } from "@nudge/shared";

@Processor(QUEUE_NAMES.RESEND_EVENTS, { concurrency: 5 })
@Injectable()
export class ResendEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(ResendEventsProcessor.name);

  async process(job: Job<ResendEventsJobData>): Promise<void> {
    this.logger.log({
      msg: "Processing Resend event",
      event: "resend_event_processing",
      jobId: job.id,
    });
  }
}
