import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
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
import { EnrollInvoicesUseCase } from "./application/enroll-invoices.use-case";
import { AttachCustomerUseCase } from "./application/attach-customer.use-case";
import {
  addStepSchema,
  attachCustomerSchema,
  businessIdQuerySchema,
  createSequenceSchema,
  enrollInvoicesSchema,
  replaceSequenceSchema,
  reorderStepsSchema,
  updateSequenceSchema,
  updateStepSchema,
  type AddStepDto,
  type AttachCustomerDto,
  type CreateSequenceDto,
  type EnrollInvoicesDto,
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
    private readonly enrollInvoices: EnrollInvoicesUseCase,
    private readonly attachCustomerUseCase: AttachCustomerUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const result = await this.listSequences.execute(businessId);
    return { data: result };
  }

  @Get(":id")
  async getById(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const result = await this.getSequence.execute(id, businessId);
    return { data: result };
  }

  @Post()
  @HttpCode(201)
  async create(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createSequenceSchema)) dto: CreateSequenceDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
    const result = await this.createSequence.execute(dto.businessId, { name: dto.name, relationshipTierId: dto.relationshipTierId, steps: dto.steps });
    return { data: result };
  }

  @Patch(":id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSequenceSchema)) dto: UpdateSequenceDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
    const result = await this.updateSequence.execute(id, dto.businessId, {
      name: dto.name,
      isActive: dto.isActive,
      relationshipTierId: dto.relationshipTierId,
    });
    return { data: result };
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    await this.deleteSequence.execute(id, businessId);
  }

  @Post(":id/steps")
  @HttpCode(201)
  async addSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(addStepSchema)) dto: AddStepDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const result = await this.addStep.execute(sequenceId, businessId, dto);
    return { data: result };
  }

  @Patch(":id/steps/:stepId")
  async updateSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(updateStepSchema)) dto: UpdateStepDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const result = await this.updateStep.execute(stepId, sequenceId, businessId, dto);
    return { data: result };
  }

  @Delete(":id/steps/:stepId")
  @HttpCode(204)
  async deleteSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    await this.deleteStep.execute(stepId, sequenceId, businessId);
  }

  @Patch(":id/steps/reorder")
  async reorderSequenceSteps(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(reorderStepsSchema)) dto: ReorderStepsDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    await this.reorderSteps.execute(sequenceId, businessId, dto.steps);
    return { data: null };
  }

  @Put(":id")
  async replace(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceSequenceSchema)) dto: ReplaceSequenceDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
    const result = await this.replaceSequence.execute(id, dto.businessId, {
      name: dto.name,
      relationshipTierId: dto.relationshipTierId,
      steps: dto.steps,
    });
    return { data: result };
  }

  @Post(":id/steps/:stepId/preview")
  @HttpCode(200)
  async previewSequenceStep(
    @AccountId() clerkUserId: string,
    @Param("id") sequenceId: string,
    @Param("stepId") stepId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const result = await this.previewStep.execute(sequenceId, stepId, businessId);
    return { data: result };
  }

  @Post(":id/enroll")
  @HttpCode(200)
  async enroll(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(enrollInvoicesSchema)) dto: EnrollInvoicesDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const data = await this.enrollInvoices.execute(id, businessId, dto.invoiceIds);
    return { data };
  }

  @Post(":id/attach-customer")
  @HttpCode(200)
  async attachCustomer(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
    @Body(new ZodValidationPipe(attachCustomerSchema)) dto: AttachCustomerDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
    const data = await this.attachCustomerUseCase.execute(id, businessId, dto.customerId);
    return { data };
  }
}
