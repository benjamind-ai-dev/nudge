import { Controller, Get, Query } from "@nestjs/common";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
import { GetNeedsAttentionUseCase } from "./application/get-needs-attention.use-case";
import { GetRecentWinsUseCase } from "./application/get-recent-wins.use-case";
import {
  dashboardSummaryQuerySchema,
  type DashboardSummaryQuery,
  needsAttentionQuerySchema,
  type NeedsAttentionQuery,
  recentWinsQuerySchema,
  type RecentWinsQuery,
} from "./dto/dashboard.dto";

@Controller("v1/dashboard")
export class DashboardController {
  constructor(
    private readonly getDashboardSummary: GetDashboardSummaryUseCase,
    private readonly getNeedsAttention: GetNeedsAttentionUseCase,
    private readonly getRecentWins: GetRecentWinsUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get("summary")
  async summary(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(dashboardSummaryQuerySchema))
    query: DashboardSummaryQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getDashboardSummary.execute(query.businessId);
    return { data };
  }

  @Get("needs-attention")
  async needsAttention(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(needsAttentionQuerySchema))
    query: NeedsAttentionQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getNeedsAttention.execute(query.businessId, query.limit);
    return { data };
  }

  @Get("recent-wins")
  async recentWins(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(recentWinsQuerySchema))
    query: RecentWinsQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getRecentWins.execute(query.businessId, query.limit);
    return { data };
  }
}
