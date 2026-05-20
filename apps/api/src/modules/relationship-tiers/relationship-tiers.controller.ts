import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
import { ListTiersUseCase } from "./application/list-tiers.use-case";
import { CreateTierUseCase } from "./application/create-tier.use-case";
import { UpdateTierUseCase } from "./application/update-tier.use-case";
import { DeleteTierUseCase } from "./application/delete-tier.use-case";
import {
  BusinessHasNoDefaultTierError,
  CannotDeleteDefaultTierError,
  CannotDeleteTierWithActiveSequencesError,
  RelationshipTierNotFoundError,
  TierLimitReachedError,
  TierNameAlreadyExistsError,
} from "./domain/relationship-tier.errors";
import {
  createTierSchema,
  deleteTierQuerySchema,
  listTiersQuerySchema,
  updateTierSchema,
  type CreateTierDto,
  type DeleteTierQuery,
  type ListTiersQuery,
  type UpdateTierDto,
} from "./dto/relationship-tiers.dto";

@Controller("v1/relationship-tiers")
export class RelationshipTiersController {
  constructor(
    private readonly listTiers: ListTiersUseCase,
    private readonly createTier: CreateTierUseCase,
    private readonly updateTier: UpdateTierUseCase,
    private readonly deleteTier: DeleteTierUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listTiersQuerySchema)) query: ListTiersQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.listTiers.execute(query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Post()
  async create(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(createTierSchema)) dto: CreateTierDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const data = await this.createTier.execute(dto.businessId, {
        name: dto.name,
        description: dto.description,
      });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (
        error instanceof TierLimitReachedError ||
        error instanceof TierNameAlreadyExistsError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTierSchema)) dto: UpdateTierDto,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
      const data = await this.updateTier.execute(id, dto.businessId, {
        name: dto.name,
        description: dto.description,
        sequenceId: dto.sequenceId,
        isDefault: dto.isDefault,
        sortOrder: dto.sortOrder,
      });
      return { data };
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof RelationshipTierNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof TierNameAlreadyExistsError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(deleteTierQuerySchema)) query: DeleteTierQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      await this.deleteTier.execute(id, query.businessId);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof CallerNotProvisionedError) throw new UnauthorizedException(error.message);
      if (error instanceof RelationshipTierNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof CannotDeleteDefaultTierError ||
        error instanceof CannotDeleteTierWithActiveSequencesError
      ) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof BusinessHasNoDefaultTierError) {
        throw new InternalServerErrorException(error.message);
      }
      throw error;
    }
  }
}
