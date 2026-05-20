import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { PauseSequenceRunUseCase } from "./application/pause-sequence-run.use-case";
import { ResumeSequenceRunUseCase } from "./application/resume-sequence-run.use-case";
import { StopSequenceRunUseCase } from "./application/stop-sequence-run.use-case";
import {
  InvalidStatusTransitionError,
  SequenceRunNotFoundError,
} from "./domain/sequence-run.errors";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
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
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      return this.listSequenceRuns.execute(query);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getSequenceRunQuerySchema)) query: GetSequenceRunQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.getSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(pauseBodySchema)) _body: PauseBody,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.pauseSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/resume")
  @HttpCode(200)
  async resume(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.resumeSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/stop")
  @HttpCode(200)
  async stop(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(stopBodySchema)) _body: StopBody,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.stopSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
