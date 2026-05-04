import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListSequencesUseCase } from "./application/list-sequences.use-case";
import { GetSequenceUseCase } from "./application/get-sequence.use-case";
import { CreateSequenceUseCase } from "./application/create-sequence.use-case";
import { UpdateSequenceUseCase } from "./application/update-sequence.use-case";
import { DeleteSequenceUseCase } from "./application/delete-sequence.use-case";
import { AddStepUseCase } from "./application/add-step.use-case";
import { UpdateStepUseCase } from "./application/update-step.use-case";
import { DeleteStepUseCase } from "./application/delete-step.use-case";
import { ReorderStepsUseCase } from "./application/reorder-steps.use-case";
import { SequenceInUseError, SequenceNotFoundError, SequenceStepNotFoundError } from "./domain/sequence.errors";
import {
  addStepSchema,
  businessIdQuerySchema,
  createSequenceSchema,
  reorderStepsSchema,
  updateSequenceSchema,
  updateStepSchema,
  type AddStepDto,
  type CreateSequenceDto,
  type ReorderStepsDto,
  type UpdateSequenceDto,
  type UpdateStepDto,
} from "./dto/sequences.dto";

@Controller("v1/sequences")
export class SequencesController {
  constructor(
    private readonly listSequences: ListSequencesUseCase,
    private readonly getSequence: GetSequenceUseCase,
    private readonly createSequence: CreateSequenceUseCase,
    private readonly updateSequence: UpdateSequenceUseCase,
    private readonly deleteSequence: DeleteSequenceUseCase,
    private readonly addStep: AddStepUseCase,
    private readonly updateStep: UpdateStepUseCase,
    private readonly deleteStep: DeleteStepUseCase,
    private readonly reorderSteps: ReorderStepsUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    const result = await this.listSequences.execute(businessId);
    return { data: result };
  }

  @Get(":id")
  async getById(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      const result = await this.getSequence.execute(id, businessId);
      return { data: result };
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @AccountId() _accountId: string,
    @Body(new ZodValidationPipe(createSequenceSchema)) dto: CreateSequenceDto,
  ) {
    const result = await this.createSequence.execute(dto.businessId, dto.name);
    return { data: result };
  }

  @Patch(":id")
  async update(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSequenceSchema)) dto: UpdateSequenceDto,
  ) {
    try {
      const result = await this.updateSequence.execute(id, dto.businessId, dto.name);
      return { data: result };
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.deleteSequence.execute(id, businessId);
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceInUseError) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post(":id/steps")
  @HttpCode(201)
  async addSequenceStep(
    @AccountId() _accountId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(addStepSchema)) dto: AddStepDto,
  ) {
    try {
      const result = await this.addStep.execute(sequenceId, businessId, dto);
      return { data: result };
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Patch(":id/steps/:stepId")
  async updateSequenceStep(
    @AccountId() _accountId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(updateStepSchema)) dto: UpdateStepDto,
  ) {
    try {
      const result = await this.updateStep.execute(stepId, sequenceId, businessId, dto);
      return { data: result };
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceStepNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Delete(":id/steps/:stepId")
  @HttpCode(204)
  async deleteSequenceStep(
    @AccountId() _accountId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.deleteStep.execute(stepId, sequenceId, businessId);
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceStepNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Patch(":id/steps/reorder")
  async reorderSequenceSteps(
    @AccountId() _accountId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(reorderStepsSchema)) dto: ReorderStepsDto,
  ) {
    try {
      await this.reorderSteps.execute(sequenceId, businessId, dto.steps);
      return { data: null };
    } catch (error) {
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
