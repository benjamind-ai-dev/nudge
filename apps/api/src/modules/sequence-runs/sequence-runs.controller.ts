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
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query(new ZodValidationPipe(listSequenceRunsQuerySchema)) query: ListSequenceRunsQuery,
  ) {
    return this.listSequenceRuns.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getSequenceRunQuerySchema)) query: GetSequenceRunQuery,
  ) {
    try {
      const data = await this.getSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(pauseBodySchema)) _body: PauseBody,
  ) {
    try {
      const data = await this.pauseSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
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
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
  ) {
    try {
      const data = await this.resumeSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
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
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(actionQuerySchema)) query: ActionQuery,
    @Body(new ZodValidationPipe(stopBodySchema)) _body: StopBody,
  ) {
    try {
      const data = await this.stopSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
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
