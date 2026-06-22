import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { TriggerManualSyncUseCase } from "./application/trigger-manual-sync.use-case";
import { ListBusinessesUseCase } from "./application/list-businesses.use-case";
import { SyncRateLimitedError } from "./domain/business.errors";
import {
  createBusinessSchema,
  type CreateBusinessDto,
} from "./dto/create-business.dto";
import {
  updateBusinessSettingsSchema,
  type UpdateBusinessSettingsDto,
} from "./dto/update-business-settings.dto";
import {
  triggerManualSyncSchema,
  type TriggerManualSyncDto,
} from "./dto/trigger-manual-sync.dto";

@Controller("v1/businesses")
export class BusinessController {
  constructor(
    private readonly getBusiness: GetBusinessUseCase,
    private readonly createBusiness: CreateBusinessUseCase,
    private readonly listBusinesses: ListBusinessesUseCase,
    private readonly updateSettings: UpdateBusinessSettingsUseCase,
    private readonly deleteBusiness: DeleteBusinessUseCase,
    private readonly triggerSync: TriggerManualSyncUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
    private readonly callerCtx: CallerContextService,
  ) {}

  @Get()
  async list(@AccountId() clerkUserId: string) {
    const ctx = await this.callerCtx.resolve(clerkUserId);
    if (!ctx) throw new UnauthorizedException("Caller not provisioned");
    const result = await this.listBusinesses.execute(ctx.accountId);
    return { data: result };
  }

  @Get(":id")
  async getById(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, id);
    const result = await this.getBusiness.execute(id);
    return { data: result };
  }

  @Post()
  @HttpCode(201)
  async create(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createBusinessSchema)) dto: CreateBusinessDto,
  ) {
    const ctx = await this.callerCtx.resolve(clerkUserId);
    if (!ctx) throw new UnauthorizedException("Caller not provisioned");
    const result = await this.createBusiness.execute({
      ...dto,
      accountId: ctx.accountId,
    });
    return { data: result };
  }

  @Patch(":id")
  async updateById(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBusinessSettingsSchema)) dto: UpdateBusinessSettingsDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, id);
    const result = await this.updateSettings.execute({
      businessId: id,
      settings: dto,
    });
    return { data: result };
  }

  @Delete(":id")
  @HttpCode(204)
  async deleteById(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, id);
    await this.deleteBusiness.execute(id);
  }

  @Post(":id/sync")
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerManualSync(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(triggerManualSyncSchema)) _body: TriggerManualSyncDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, id);
    try {
      const result = await this.triggerSync.execute(id);
      return { data: result };
    } catch (error) {
      // SyncRateLimitedError needs a Retry-After header and a custom envelope
      // field, which the global filter's status-only mapping can't express.
      if (error instanceof SyncRateLimitedError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
        throw new HttpException(
          {
            statusCode: 429,
            error: "Too Many Requests",
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds,
          },
          429,
        );
      }
      throw error;
    }
  }
}
