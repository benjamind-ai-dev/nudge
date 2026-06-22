import { Module } from "@nestjs/common";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
import { GetNeedsAttentionUseCase } from "./application/get-needs-attention.use-case";
import { GetRecentWinsUseCase } from "./application/get-recent-wins.use-case";
import { DASHBOARD_SUMMARY_REPOSITORY } from "./domain/dashboard-summary.repository";
import { NEEDS_ATTENTION_REPOSITORY } from "./domain/needs-attention.repository";
import { RECENT_WINS_REPOSITORY } from "./domain/recent-wins.repository";
import { PrismaDashboardSummaryRepository } from "./infrastructure/prisma-dashboard-summary.repository";
import { PrismaNeedsAttentionRepository } from "./infrastructure/prisma-needs-attention.repository";
import { PrismaRecentWinsRepository } from "./infrastructure/prisma-recent-wins.repository";
import { DashboardController } from "./dashboard.controller";

@Module({
  controllers: [DashboardController],
  providers: [
    GetDashboardSummaryUseCase,
    { provide: DASHBOARD_SUMMARY_REPOSITORY, useClass: PrismaDashboardSummaryRepository },
    GetNeedsAttentionUseCase,
    { provide: NEEDS_ATTENTION_REPOSITORY, useClass: PrismaNeedsAttentionRepository },
    GetRecentWinsUseCase,
    { provide: RECENT_WINS_REPOSITORY, useClass: PrismaRecentWinsRepository },
  ],
})
export class DashboardModule {}
