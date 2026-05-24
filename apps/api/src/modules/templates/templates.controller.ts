import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import {
  businessIdQuerySchema,
  createTemplateSchema,
  type CreateTemplateDto,
  updateTemplateSchema,
  type UpdateTemplateDto,
  generateTemplateSchema,
  type GenerateTemplateDto,
  attachTemplateSchema,
  type AttachTemplateDto,
} from "./dto/templates.dto";
import { ListTemplatesUseCase } from "./application/list-templates.use-case";
import { GetTemplateUseCase } from "./application/get-template.use-case";
import { CreateTemplateUseCase } from "./application/create-template.use-case";
import { UpdateTemplateUseCase } from "./application/update-template.use-case";
import { DeleteTemplateUseCase } from "./application/delete-template.use-case";
import { GenerateTemplateUseCase } from "./application/generate-template.use-case";
import { AttachTemplateToCustomerUseCase } from "./application/attach-template-to-customer.use-case";
import { DetachTemplateFromCustomerUseCase } from "./application/detach-template-from-customer.use-case";
import type { Template } from "./domain/template.entity";
import type { AiTemplateDraft } from "./application/ports/ai-template.client";

@Controller("v1")
export class TemplatesController {
  constructor(
    private readonly businessAuth: BusinessAuthorizationService,
    private readonly listUc: ListTemplatesUseCase,
    private readonly getUc: GetTemplateUseCase,
    private readonly createUc: CreateTemplateUseCase,
    private readonly updateUc: UpdateTemplateUseCase,
    private readonly deleteUc: DeleteTemplateUseCase,
    private readonly generateUc: GenerateTemplateUseCase,
    private readonly attachUc: AttachTemplateToCustomerUseCase,
    private readonly detachUc: DetachTemplateFromCustomerUseCase,
  ) {}

  @Get("templates")
  async list(
    @AccountId() clerkUserId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ): Promise<{ data: Template[] }> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const data = await this.listUc.execute({ businessId });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Get("templates/:id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ): Promise<{ data: Template }> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const data = await this.getUc.execute({ id, businessId });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Post("templates/generate")
  @HttpCode(HttpStatus.OK)
  async generate(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(generateTemplateSchema)) body: GenerateTemplateDto,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ): Promise<{ data: AiTemplateDraft }> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      const data = await this.generateUc.execute({ description: body.description });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Post("templates")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateDto,
  ): Promise<{ data: Template }> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, body.businessId);
      const data = await this.createUc.execute({
        businessId: body.businessId,
        name: body.name,
        subject: body.subject ?? null,
        body: body.body,
        signature: body.signature ?? null,
      });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Patch("templates/:id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) patch: UpdateTemplateDto,
  ): Promise<{ data: Template }> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, patch.businessId);
      const { businessId, ...patchFields } = patch;
      const data = await this.updateUc.execute({ id, businessId, patch: patchFields });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Delete("templates/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ): Promise<void> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      await this.deleteUc.execute({ id, businessId });
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Post("customers/:customerId/templates")
  @HttpCode(HttpStatus.CREATED)
  async attach(
    @AccountId() clerkUserId: string,
    @Param("customerId") customerId: string,
    @Body(new ZodValidationPipe(attachTemplateSchema)) body: AttachTemplateDto,
  ): Promise<void> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, body.businessId);
      await this.attachUc.execute({
        templateId: body.templateId,
        customerId,
        businessId: body.businessId,
      });
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Delete("customers/:customerId/templates/:templateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async detach(
    @AccountId() clerkUserId: string,
    @Param("customerId") customerId: string,
    @Param("templateId") templateId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ): Promise<void> {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, businessId);
      await this.detachUc.execute({ templateId, customerId, businessId });
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }
}
