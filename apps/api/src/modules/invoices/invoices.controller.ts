import { Controller, Get, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { businessIdQuerySchema } from "./dto/invoices.dto";

@Controller("v1/invoices")
export class InvoicesController {
  constructor(private readonly listInvoices: ListInvoicesUseCase) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query("businessId", new ZodValidationPipe(businessIdQuerySchema)) businessId: string,
  ) {
    const result = await this.listInvoices.execute(businessId);
    return { data: result };
  }
}
