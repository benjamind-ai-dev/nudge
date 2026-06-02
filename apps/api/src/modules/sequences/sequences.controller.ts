import {
  BadRequestException,
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
  Put,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import { ListSequencesUseCase } from "./application/list-sequences.use-case";
import { GetSequenceUseCase } from "./application/get-sequence.use-case";
import { CreateSequenceUseCase } from "./application/create-sequence.use-case";
import { UpdateSequenceUseCase } from "./application/update-sequence.use-case";
import { DeleteSequenceUseCase } from "./application/delete-sequence.use-case";
import { AddStepUseCase } from "./application/add-step.use-case";
import { UpdateStepUseCase } from "./application/update-step.use-case";
import { DeleteStepUseCase } from "./application/delete-step.use-case";
import { ReorderStepsUseCase } from "./application/reorder-steps.use-case";
import { ReplaceSequenceUseCase } from "./application/replace-sequence.use-case";
import { PreviewStepUseCase } from "./application/preview-step.use-case";
import {
  SequenceHasActiveRunsError,
  SequenceInUseError,
  SequenceNotFoundError,
  SequenceStepNotFoundError,
  SequenceLimitReachedError,
  StepLimitReachedError,
  InvalidStepOrderError,
  SmsNotAvailableOnPlanError,
} from "./domain/sequence.errors";
import { RelationshipTierNotFoundError } from "../relationship-tiers/domain/relationship-tier.errors";
import {
  addStepSchema,
  businessIdQuerySchema,
  createSequenceSchema,
  replaceSequenceSchema,
  reorderStepsSchema,
  updateSequenceSchema,
  updateStepSchema,
  type AddStepDto,
  type CreateSequenceDto,
  type ReplaceSequenceDto,
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
    private readonly replaceSequence: ReplaceSequenceUseCase,
    private readonly addStep: AddStepUseCase,
    private readonly updateStep: UpdateStepUseCase,
    private readonly deleteStep: DeleteStepUseCase,
    private readonly reorderSteps: ReorderStepsUseCase,
    private readonly previewStep: PreviewStepUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const result = await this.listSequences.execute(businessId);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Get(":id")
  async getById(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const result = await this.getSequence.execute(id, businessId);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createSequenceSchema)) dto: CreateSequenceDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const result = await this.createSequence.execute(dto.businessId, { name: dto.name, relationshipTierId: dto.relationshipTierId, steps: dto.steps });
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceLimitReachedError) throw new BadRequestException(error.message);
      if (error instanceof StepLimitReachedError) throw new BadRequestException(error.message);
      if (error instanceof InvalidStepOrderError) throw new BadRequestException(error.message);
      if (error instanceof SmsNotAvailableOnPlanError) throw new UnprocessableEntityException(error.message);
      if (error instanceof RelationshipTierNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Patch(":id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSequenceSchema)) dto: UpdateSequenceDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const result = await this.updateSequence.execute(id, dto.businessId, {
        name: dto.name,
        isActive: dto.isActive,
        relationshipTierId: dto.relationshipTierId,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof RelationshipTierNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      await this.deleteSequence.execute(id, businessId);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceInUseError) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post(":id/steps")
  @HttpCode(201)
  async addSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(addStepSchema)) dto: AddStepDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const result = await this.addStep.execute(sequenceId, businessId, dto);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SmsNotAvailableOnPlanError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  @Patch(":id/steps/:stepId")
  async updateSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(updateStepSchema)) dto: UpdateStepDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const result = await this.updateStep.execute(stepId, sequenceId, businessId, dto);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceStepNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SmsNotAvailableOnPlanError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  @Delete(":id/steps/:stepId")
  @HttpCode(204)
  async deleteSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      await this.deleteStep.execute(stepId, sequenceId, businessId);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceStepNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Patch(":id/steps/reorder")
  async reorderSequenceSteps(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(reorderStepsSchema)) dto: ReorderStepsDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      await this.reorderSteps.execute(sequenceId, businessId, dto.steps);
      return { data: null };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Put(":id")
  async replace(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceSequenceSchema)) dto: ReplaceSequenceDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const result = await this.replaceSequence.execute(id, dto.businessId, {
        name: dto.name,
        relationshipTierId: dto.relationshipTierId,
        steps: dto.steps,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceHasActiveRunsError) throw new BadRequestException(error.message);
      if (error instanceof StepLimitReachedError) throw new BadRequestException(error.message);
      if (error instanceof InvalidStepOrderError) throw new BadRequestException(error.message);
      if (error instanceof SmsNotAvailableOnPlanError) throw new UnprocessableEntityException(error.message);
      if (error instanceof RelationshipTierNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }

  @Post(":id/steps/:stepId/preview")
  @HttpCode(200)
  async previewSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const result = await this.previewStep.execute(sequenceId, stepId, businessId);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof SequenceNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof SequenceStepNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
