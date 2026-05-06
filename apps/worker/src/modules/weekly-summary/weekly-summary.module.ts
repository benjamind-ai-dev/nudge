import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../common/database/database.module";

import { WEEKLY_SUMMARY_REPOSITORY } from "./domain/weekly-summary.repository";
import { METRICS_REPOSITORY } from "./domain/metrics.repository";
import { AI_SUMMARY_CLIENT } from "./application/ports/ai-summary.client";
import { SUMMARY_EMAIL_SENDER } from "./application/ports/summary-email.sender";
import {
  DISPATCH_CLOCK,
  BUSINESS_TIMEZONE_READER,
  WEEKLY_SUMMARY_PRODUCER,
  DispatchWeeklySummariesUseCase,
} from "./application/dispatch-weekly-summaries.use-case";
import { GenerateWeeklySummaryUseCase } from "./application/generate-weekly-summary.use-case";
import { SUMMARY_RENDERER } from "./application/ports/summary-renderer";
import { ComputeBusinessMetricsUseCase } from "./application/compute-business-metrics.use-case";
import { BuildSummaryPromptUseCase } from "./application/build-summary-prompt.use-case";

import { PrismaWeeklySummaryRepository } from "./infrastructure/prisma-weekly-summary.repository";
import { PrismaMetricsRepository } from "./infrastructure/prisma-metrics.repository";
import { PrismaBusinessTimezoneReader } from "./infrastructure/prisma-business-timezone.reader";
import { BullmqWeeklySummaryProducer } from "./infrastructure/bullmq-weekly-summary.producer";
import { VercelAiSummaryClient } from "./infrastructure/vercel-ai-summary.client";
import { ResendSummaryEmailSender } from "./infrastructure/resend-summary-email.sender";
import { HandlebarsSummaryRenderer } from "./infrastructure/handlebars-summary-renderer";
import { WeeklySummaryProcessor } from "./infrastructure/processors/weekly-summary.processor";

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    WeeklySummaryProcessor,
    DispatchWeeklySummariesUseCase,
    GenerateWeeklySummaryUseCase,
    ComputeBusinessMetricsUseCase,
    BuildSummaryPromptUseCase,
    { provide: WEEKLY_SUMMARY_REPOSITORY, useClass: PrismaWeeklySummaryRepository },
    { provide: METRICS_REPOSITORY, useClass: PrismaMetricsRepository },
    { provide: AI_SUMMARY_CLIENT, useClass: VercelAiSummaryClient },
    { provide: SUMMARY_EMAIL_SENDER, useClass: ResendSummaryEmailSender },
    { provide: SUMMARY_RENDERER, useClass: HandlebarsSummaryRenderer },
    { provide: BUSINESS_TIMEZONE_READER, useClass: PrismaBusinessTimezoneReader },
    { provide: WEEKLY_SUMMARY_PRODUCER, useClass: BullmqWeeklySummaryProducer },
    { provide: DISPATCH_CLOCK, useValue: { now: () => new Date() } },
  ],
})
export class WeeklySummaryModule {}
