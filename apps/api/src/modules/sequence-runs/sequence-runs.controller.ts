import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { PauseSequenceRunUseCase } from "./application/pause-sequence-run.use-case";
import { ResumeSequenceRunUseCase } from "./application/resume-sequence-run.use-case";
import { StopSequenceRunUseCase } from "./application/stop-sequence-run.use-case";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import {
  actionQuerySchema,
  getSequenceRunQuerySchema,
  listSequenceRunsQuerySchema,
  pauseBodySchema,
  stopBodySchema,
  type ActionQuery,
  type GetSequenceRunQuery,
  type ListSequenceRunsQuery,
  type PauseBody,
  type StopBody,
} from "./dto/sequence-runs.dto";

@Controller("v1/sequence-runs")
export class SequenceRunsController {
  constructor(
    private readonly listSequenceRuns: ListSequenceRunsUseCase,
    private readonly getSequenceRun: GetSequenceRunUseCase,
    private readonly pauseSequenceRun: PauseSequenceRunUseCase,
    private readonly resumeSequenceRun: ResumeSequenceRunUseCase,
    private readonly stopSequenceRun: StopSequenceRunUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listSequenceRunsQuerySchema)) query: ListSequenceRunsQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    return this.listSequenceRuns.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getSequenceRunQuerySchema)) query: GetSequenceRunQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getSequenceRun.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(pauseBodySchema)) _body: PauseBody,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.pauseSequenceRun.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/resume")
  @HttpCode(200)
  async resume(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.resumeSequenceRun.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/stop")
  @HttpCode(200)
  async stop(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(stopBodySchema)) _body: StopBody,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.stopSequenceRun.execute(id, query.businessId);
    return { data };
  }
}
