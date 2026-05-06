import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "@nudge/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  triggerWeeklySummarySchema,
  type TriggerWeeklySummaryDto,
} from "./dto/trigger-weekly-summary.dto";
import { DevKeyGuard } from "./infrastructure/dev-key.guard";

@Controller("v1/dev")
@UseGuards(DevKeyGuard)
export class DevController {
  constructor(
    @InjectQueue(QUEUE_NAMES.WEEKLY_SUMMARY)
    private readonly weeklySummaryQueue: Queue,
  ) {}

  @Post("weekly-summary/trigger")
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ZodValidationPipe(triggerWeeklySummarySchema))
  async triggerWeeklySummary(
    @Body() body: TriggerWeeklySummaryDto,
  ): Promise<{ data: { jobId: string; businessId: string; weekStartsAt: string } }> {
    const weekStartsAt = body.weekStartsAt ?? mostRecentMondayUtc();

    const job = await this.weeklySummaryQueue.add(
      JOB_NAMES.WEEKLY_SUMMARY_BUSINESS,
      { businessId: body.businessId, weekStartsAt },
      { attempts: 1 },
    );

    return {
      data: {
        jobId: String(job.id),
        businessId: body.businessId,
        weekStartsAt,
      },
    };
  }
}

function mostRecentMondayUtc(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const offsetToMonday = (day + 6) % 7; // 0 if Monday, 1 if Tuesday, ...
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - offsetToMonday);
  return monday.toISOString().slice(0, 10);
}
