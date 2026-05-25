import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError as CanonicalBusinessNotFoundError } from "../business/domain/business.errors";
import { StartConnectionUseCase } from "../connections-common/application/start-connection.use-case";
import { BusinessNotFoundError } from "../connections-common/domain/connection.errors";
import { authorizeSchema, AuthorizeDto } from "./dto/authorize.dto";
import { RATE_LIMITS, RATE_LIMIT_NAMES } from "../../common/throttler/throttler-config";

@SkipThrottle({ [RATE_LIMIT_NAMES.DEFAULT]: true, [RATE_LIMIT_NAMES.WEBHOOKS]: true })
@Throttle({ [RATE_LIMIT_NAMES.AUTH]: RATE_LIMITS.AUTH })
@Controller("v1/connections")
export class ConnectionsController {
  constructor(
    private readonly useCase: StartConnectionUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Post("authorize")
  @HttpCode(200)
  async authorize(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(authorizeSchema)) dto: AuthorizeDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const result = await this.useCase.execute({
        businessId: dto.businessId,
        provider: dto.provider,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof CanonicalBusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
