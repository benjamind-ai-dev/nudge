import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { CallerNotProvisionedError } from "../../common/auth-context/business-authorization.errors";
import { BusinessNotFoundError } from "../business/domain/business.errors";
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
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listInvoicesQuerySchema))
    query: ListInvoicesQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      return this.listInvoices.execute(query);
    } catch (error) {
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getInvoiceQuerySchema))
    query: GetInvoiceQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.getInvoice.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/payment-link")
  @HttpCode(200)
  async generatePaymentLink(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(createPaymentLinkQuerySchema))
    query: CreatePaymentLinkQuery,
  ) {
    try {
      await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
      const data = await this.createPaymentLink.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof BusinessNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CallerNotProvisionedError) {
        throw new UnauthorizedException(error.message);
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
