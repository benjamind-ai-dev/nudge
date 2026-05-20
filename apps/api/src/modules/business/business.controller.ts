import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UsePipes,
} from "@nestjs/common";
import type { Response } from "express";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { TriggerManualSyncUseCase } from "./application/trigger-manual-sync.use-case";
import {
  BusinessNotFoundError,
  NoActiveConnectionError,
  SyncRateLimitedError,
} from "./domain/business.errors";
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
    private readonly updateSettings: UpdateBusinessSettingsUseCase,
    private readonly deleteBusiness: DeleteBusinessUseCase,
    private readonly triggerSync: TriggerManualSyncUseCase,
  ) {}

  @Get(":id")
  async getById(@Param("id") id: string) {
    try {
      const result = await this.getBusiness.execute(id);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createBusinessSchema))
  async create(@Body() dto: CreateBusinessDto) {
    const result = await this.createBusiness.execute(dto);
    return { data: result };
  }

  @Patch(":id")
  async updateById(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBusinessSettingsSchema)) dto: UpdateBusinessSettingsDto,
  ) {
    try {
      const result = await this.updateSettings.execute({
        businessId: id,
        settings: dto,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async deleteById(
    @AccountId() _accountId: string,
    @Param("id") id: string,
  ) {
    try {
      await this.deleteBusiness.execute(id);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/sync")
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerManualSync(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(triggerManualSyncSchema)) _body: TriggerManualSyncDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.triggerSync.execute(id);
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof NoActiveConnectionError) {
        throw new ConflictException(error.message);
      }
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
