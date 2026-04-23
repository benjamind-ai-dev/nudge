import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UsePipes,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { BusinessNotFoundError } from "./domain/business.errors";
import {
  updateBusinessSettingsSchema,
  type UpdateBusinessSettingsDto,
} from "./dto/update-business-settings.dto";

@Controller("v1/business")
export class BusinessController {
  constructor(private readonly updateSettings: UpdateBusinessSettingsUseCase) {}

  @Patch(":id/settings")
  @UsePipes(new ZodValidationPipe(updateBusinessSettingsSchema))
  async updateBusinessSettings(
    @Param("id") businessId: string,
    @Body() dto: UpdateBusinessSettingsDto,
  ) {
    try {
      const result = await this.updateSettings.execute({
        businessId,
        settings: {
          senderName: dto.senderName,
          senderEmail: dto.senderEmail,
          emailSignature: dto.emailSignature,
          timezone: dto.timezone,
        },
      });
      return { data: result };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
