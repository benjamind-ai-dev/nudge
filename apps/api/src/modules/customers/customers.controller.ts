import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { GetCustomerUseCase } from "./application/get-customer.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { AssignCustomerTierUseCase } from "./application/assign-customer-tier.use-case";
import {
  CustomerNotFoundError,
  SequenceBelongsToDifferentBusinessError,
  TierBelongsToDifferentBusinessError,
} from "./domain/customer.errors";
import {
  assignTierBodySchema,
  getCustomerQuerySchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
  type AssignTierDto,
  type GetCustomerQuery,
  type ListCustomersQuery,
  type UpdateCustomerDto,
} from "./dto/customers.dto";

@Controller("v1/customers")
export class CustomersController {
  constructor(
    private readonly listCustomers: ListCustomersUseCase,
    private readonly getCustomer: GetCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly assignCustomerTier: AssignCustomerTierUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery,
  ) {
    return this.listCustomers.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getCustomerQuerySchema)) query: GetCustomerQuery,
  ) {
    try {
      const data = await this.getCustomer.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id")
  async update(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    try {
      const data = await this.updateCustomer.execute(id, dto.businessId, {
        relationshipTierId: dto.relationshipTierId,
        sequenceId: dto.sequenceId,
      });
      return { data };
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof TierBelongsToDifferentBusinessError ||
        error instanceof SequenceBelongsToDifferentBusinessError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id/tier")
  async assignTier(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignTierBodySchema)) dto: AssignTierDto,
  ) {
    try {
      const data = await this.assignCustomerTier.execute(id, dto.businessId, dto.tierId);
      return { data };
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof TierBelongsToDifferentBusinessError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
