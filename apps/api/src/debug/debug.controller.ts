import { Controller, Post, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { Env } from "../common/config/env.schema";

@Controller("debug")
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly testQueue: Queue,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("test-job")
  async enqueueTestJob() {
    const nodeEnv = this.config.get("NODE_ENV", { infer: true });
    if (nodeEnv === "production") {
      return {
        data: { message: "Debug endpoints are disabled in production" },
      };
    }

    const job = await this.testQueue.add("test-job", {
      message: "Hello from debug endpoint",
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Test job enqueued with id: ${job.id}`);

    return {
      data: { jobId: job.id, queue: QUEUE_NAMES.INVOICE_SYNC },
    };
  }
}
