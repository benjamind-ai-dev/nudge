import { Controller, Get, Query, Res } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CompleteConnectionUseCase } from "../connections-common/application/complete-connection.use-case";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "../../common/throttler/throttler-config";

@SkipThrottle({ [RATE_LIMIT_NAMES.DEFAULT]: true, [RATE_LIMIT_NAMES.WEBHOOKS]: true })
@Throttle({ [RATE_LIMIT_NAMES.AUTH]: RATE_LIMITS.AUTH })
@Controller("v1/connections/quickbooks")
export class QuickbooksCallbackController {
  constructor(private readonly useCase: CompleteConnectionUseCase) {}

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("realmId") realmId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { redirectUrl } = await this.useCase.execute({
      code,
      state,
      providerHint: "quickbooks",
      providerMetadata: { realmId },
    });
    res.redirect(redirectUrl);
  }
}
