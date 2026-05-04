import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { CustomerNotFoundError } from "./domain/customer.errors";
import {
  businessIdQuerySchema,
  updateCustomerSchema,
  type UpdateCustomerDto,
} from "./dto/customers.dto";

@Controller("v1/customers")
export class CustomersController {
  constructor(
    private readonly listCustomers: ListCustomersUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    const result = await this.listCustomers.execute(businessId);
    return { data: result };
  }

  @Patch(":id")
  async update(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    try {
      const result = await this.updateCustomer.execute(id, dto.businessId, {
        relationshipTierId: dto.relationshipTierId,
        sequenceId: dto.sequenceId,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof CustomerNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
