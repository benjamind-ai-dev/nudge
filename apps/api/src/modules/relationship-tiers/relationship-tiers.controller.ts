import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListTiersUseCase } from "./application/list-tiers.use-case";
import { UpdateTierUseCase } from "./application/update-tier.use-case";
import { RelationshipTierNotFoundError } from "./domain/relationship-tier.errors";
import {
  businessIdQuerySchema,
  updateTierSchema,
  type UpdateTierDto,
} from "./dto/relationship-tiers.dto";

@Controller("v1/relationship-tiers")
export class RelationshipTiersController {
  constructor(
    private readonly listTiers: ListTiersUseCase,
    private readonly updateTier: UpdateTierUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    const result = await this.listTiers.execute(businessId);
    return { data: result };
  }

  @Patch(":id")
  async update(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTierSchema)) dto: UpdateTierDto,
  ) {
    try {
      const result = await this.updateTier.execute(id, dto.businessId, {
        name: dto.name,
        description: dto.description,
        sequenceId: dto.sequenceId,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof RelationshipTierNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
