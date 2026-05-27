import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.use-case";
import { GetNeedsAttentionUseCase } from "./application/get-needs-attention.use-case";
import {
  dashboardSummaryQuerySchema,
  type DashboardSummaryQuery,
  needsAttentionQuerySchema,
  type NeedsAttentionQuery,
} from "./dto/dashboard.dto";

@Controller("v1/dashboard")
export class DashboardController {
  constructor(
    private readonly getDashboardSummary: GetDashboardSummaryUseCase,
    private readonly getNeedsAttention: GetNeedsAttentionUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get("summary")
  async summary(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(dashboardSummaryQuerySchema))
    query: DashboardSummaryQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.getDashboardSummary.execute(query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get("needs-attention")
  async needsAttention(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(needsAttentionQuerySchema))
    query: NeedsAttentionQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.getNeedsAttention.execute(query.businessId, query.limit);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
