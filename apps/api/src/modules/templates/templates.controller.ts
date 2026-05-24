import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import {
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
    private readonly callerCtx: CallerContextService,
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
  async list(@AccountId() clerkUserId: string): Promise<{ data: Template[] }> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.listUc.execute({ businessId: caller.accountId });
    return { data };
  }

  @Get("templates/:id")
  async get(
    @Param("id") id: string,
    @AccountId() clerkUserId: string,
  ): Promise<{ data: Template }> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.getUc.execute({ id, businessId: caller.accountId });
    return { data };
  }

  @Post("templates/generate")
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body(new ZodValidationPipe(generateTemplateSchema)) body: GenerateTemplateDto,
    @AccountId() clerkUserId: string,
  ): Promise<{ data: AiTemplateDraft }> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.generateUc.execute({ description: body.description });
    return { data };
  }

  @Post("templates")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateDto,
    @AccountId() clerkUserId: string,
  ): Promise<{ data: Template }> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.createUc.execute({
      businessId: caller.accountId,
      name: body.name,
      subject: body.subject ?? null,
      body: body.body,
      signature: body.signature ?? null,
    });
    return { data };
  }

  @Patch("templates/:id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) patch: UpdateTemplateDto,
    @AccountId() clerkUserId: string,
  ): Promise<{ data: Template }> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.updateUc.execute({ id, businessId: caller.accountId, patch });
    return { data };
  }

  @Delete("templates/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("id") id: string,
    @AccountId() clerkUserId: string,
  ): Promise<void> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    await this.deleteUc.execute({ id, businessId: caller.accountId });
  }

  @Post("customers/:customerId/templates")
  @HttpCode(HttpStatus.CREATED)
  async attach(
    @Param("customerId") customerId: string,
    @Body(new ZodValidationPipe(attachTemplateSchema)) body: AttachTemplateDto,
    @AccountId() clerkUserId: string,
  ): Promise<void> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    await this.attachUc.execute({
      templateId: body.templateId,
      customerId,
      businessId: caller.accountId,
    });
  }

  @Delete("customers/:customerId/templates/:templateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async detach(
    @Param("customerId") customerId: string,
    @Param("templateId") templateId: string,
    @AccountId() clerkUserId: string,
  ): Promise<void> {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    await this.detachUc.execute({ templateId, customerId, businessId: caller.accountId });
  }
}
