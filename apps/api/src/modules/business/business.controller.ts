import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UsePipes,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { BusinessNotFoundError } from "./domain/business.errors";
import {
  createBusinessSchema,
  type CreateBusinessDto,
} from "./dto/create-business.dto";
import {
  updateBusinessSettingsSchema,
  type UpdateBusinessSettingsDto,
} from "./dto/update-business-settings.dto";

@Controller("v1/business")
export class BusinessController {
  constructor(
    private readonly getBusiness: GetBusinessUseCase,
    private readonly createBusiness: CreateBusinessUseCase,
    private readonly updateSettings: UpdateBusinessSettingsUseCase,
    private readonly deleteBusiness: DeleteBusinessUseCase,
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
  async deleteById(@Param("id") id: string) {
    try {
      await this.deleteBusiness.execute(id);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
