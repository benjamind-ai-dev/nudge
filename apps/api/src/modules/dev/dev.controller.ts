import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
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
import {
  triggerAiDraftSchema,
  type TriggerAiDraftDto,
} from "./dto/trigger-ai-draft.dto";
import {
  BackfillClerkOrgsUseCase,
  type BackfillClerkOrgsResult,
} from "./application/backfill-clerk-orgs.use-case";
import {
  TriggerAiDraftUseCase,
  type TriggerAiDraftResult,
} from "./application/trigger-ai-draft.use-case";
import { DevKeyGuard } from "./infrastructure/dev-key.guard";

@Controller("v1/dev")
@UseGuards(DevKeyGuard)
export class DevController {
  constructor(
    @InjectQueue(QUEUE_NAMES.WEEKLY_SUMMARY)
    private readonly weeklySummaryQueue: Queue,
    private readonly backfillClerkOrgs: BackfillClerkOrgsUseCase,
    private readonly triggerAiDraft: TriggerAiDraftUseCase,
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

  @Post("clerk-orgs/backfill")
  @HttpCode(HttpStatus.OK)
  async backfillClerkOrgsEndpoint(): Promise<{
    data: BackfillClerkOrgsResult;
  }> {
    const result = await this.backfillClerkOrgs.execute();
    return { data: result };
  }

  @Post("ai-draft/:messageId")
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ZodValidationPipe(triggerAiDraftSchema))
  async triggerAiDraftEndpoint(
    @Param("messageId") messageId: string,
    @Body() body: TriggerAiDraftDto,
  ): Promise<{ data: TriggerAiDraftResult }> {
    const result = await this.triggerAiDraft.execute(messageId, body.replyBody);
    return { data: result };
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
