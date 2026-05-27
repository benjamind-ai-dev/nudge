import { Module } from "@nestjs/common";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
import { DASHBOARD_SUMMARY_REPOSITORY } from "./domain/dashboard-summary.repository";
import { PrismaDashboardSummaryRepository } from "./infrastructure/prisma-dashboard-summary.repository";
import { DashboardController } from "./dashboard.controller";

@Module({
  controllers: [DashboardController],
  providers: [
    GetDashboardSummaryUseCase,
    { provide: DASHBOARD_SUMMARY_REPOSITORY, useClass: PrismaDashboardSummaryRepository },
  ],
})
export class DashboardModule {}
