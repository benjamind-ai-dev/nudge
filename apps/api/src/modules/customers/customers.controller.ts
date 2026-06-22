import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { ListCustomersUseCase } from "./application/list-customers.use-case";
import { GetCustomerUseCase } from "./application/get-customer.use-case";
import { UpdateCustomerUseCase } from "./application/update-customer.use-case";
import { AssignCustomerTierUseCase } from "./application/assign-customer-tier.use-case";
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
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    return this.listCustomers.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getCustomerQuerySchema)) query: GetCustomerQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getCustomer.execute(id, query.businessId);
    return { data };
  }

  @Patch(":id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
    const data = await this.updateCustomer.execute(id, dto.businessId, {
      relationshipTierId: dto.relationshipTierId,
      sequenceId: dto.sequenceId,
    });
    return { data };
  }

  @Patch(":id/tier")
  async assignTier(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignTierBodySchema)) dto: AssignTierDto,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, dto.businessId);
    const data = await this.assignCustomerTier.execute(id, dto.businessId, dto.tierId);
    return { data };
  }
}
