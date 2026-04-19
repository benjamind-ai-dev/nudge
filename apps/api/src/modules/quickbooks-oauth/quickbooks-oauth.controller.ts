import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  UsePipes,
  HttpCode,
} from "@nestjs/common";
import { Response } from "express";
import { QuickbooksOAuthService } from "./quickbooks-oauth.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { authorizeSchema, AuthorizeDto } from "./dto/authorize.dto";

@Controller("v1/connections/quickbooks")
export class QuickbooksOAuthController {
  constructor(private readonly service: QuickbooksOAuthService) {}

  @Post("authorize")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(authorizeSchema))
  async authorize(@Body() dto: AuthorizeDto) {
    const result = await this.service.authorize(dto.businessId);
    return { data: result };
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("realmId") realmId: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.service.callback(code, state, realmId);
    res.redirect(redirectUrl);
  }
}
