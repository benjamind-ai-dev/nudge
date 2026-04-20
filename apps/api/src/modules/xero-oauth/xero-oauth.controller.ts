import { Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { CompleteConnectionUseCase } from "../connections-common/application/complete-connection.use-case";

@Controller("v1/connections/xero")
export class XeroOAuthController {
  constructor(private readonly useCase: CompleteConnectionUseCase) {}

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ): Promise<void> {
    const { redirectUrl } = await this.useCase.execute({
      code,
      state,
      providerHint: "xero",
      providerMetadata: {},
    });
    res.redirect(redirectUrl);
  }
}
