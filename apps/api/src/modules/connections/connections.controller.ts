import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UsePipes,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { StartConnectionUseCase } from "../connections-common/application/start-connection.use-case";
import { BusinessNotFoundError } from "../connections-common/domain/connection.errors";
import { authorizeSchema, AuthorizeDto } from "./dto/authorize.dto";

@Controller("v1/connections")
export class ConnectionsController {
  constructor(private readonly useCase: StartConnectionUseCase) {}

  @Post("authorize")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(authorizeSchema))
  async authorize(@Body() dto: AuthorizeDto) {
    try {
      const result = await this.useCase.execute({
        businessId: dto.businessId,
        provider: dto.provider,
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
