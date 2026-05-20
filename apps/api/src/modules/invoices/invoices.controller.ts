import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { GetInvoiceUseCase } from "./application/get-invoice.use-case";
import { CreatePaymentLinkUseCase } from "./application/create-payment-link.use-case";
import {
  InvalidStateForPaymentLinkError,
  InvoiceNotFoundError,
} from "./domain/invoice.errors";
import {
  createPaymentLinkQuerySchema,
  getInvoiceQuerySchema,
  listInvoicesQuerySchema,
  type CreatePaymentLinkQuery,
  type GetInvoiceQuery,
  type ListInvoicesQuery,
} from "./dto/invoices.dto";

@Controller("v1/invoices")
export class InvoicesController {
  constructor(
    private readonly listInvoices: ListInvoicesUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly createPaymentLink: CreatePaymentLinkUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query(new ZodValidationPipe(listInvoicesQuerySchema))
    query: ListInvoicesQuery,
  ) {
    return this.listInvoices.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getInvoiceQuerySchema))
    query: GetInvoiceQuery,
  ) {
    try {
      const data = await this.getInvoice.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/payment-link")
  @HttpCode(200)
  async generatePaymentLink(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(createPaymentLinkQuerySchema))
    query: CreatePaymentLinkQuery,
  ) {
    try {
      const data = await this.createPaymentLink.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidStateForPaymentLinkError) {
        throw new BadRequestException(
          "Cannot generate payment link for a paid or voided invoice",
        );
      }
      throw error;
    }
  }
}
