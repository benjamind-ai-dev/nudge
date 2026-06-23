import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { BusinessAuthorizationService } from "../../common/auth-context/business-authorization.service";
import { ListInvoicesUseCase } from "./application/list-invoices.use-case";
import { GetInvoiceUseCase } from "./application/get-invoice.use-case";
import { CreatePaymentLinkUseCase } from "./application/create-payment-link.use-case";
import { StartFollowUpUseCase } from "./application/start-follow-up.use-case";
import {
  createPaymentLinkQuerySchema,
  getInvoiceQuerySchema,
  listInvoicesQuerySchema,
  startFollowUpQuerySchema,
  startFollowUpBodySchema,
  type CreatePaymentLinkQuery,
  type GetInvoiceQuery,
  type ListInvoicesQuery,
  type StartFollowUpQuery,
  type StartFollowUpBody,
} from "./dto/invoices.dto";

@Controller("v1/invoices")
export class InvoicesController {
  constructor(
    private readonly listInvoices: ListInvoicesUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly createPaymentLink: CreatePaymentLinkUseCase,
    private readonly startFollowUp: StartFollowUpUseCase,
    private readonly businessAuth: BusinessAuthorizationService,
  ) {}

  @Get()
  async list(
    @AccountId() clerkUserId: string,
    @Query(new ZodValidationPipe(listInvoicesQuerySchema))
    query: ListInvoicesQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    return this.listInvoices.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getInvoiceQuerySchema))
    query: GetInvoiceQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.getInvoice.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/payment-link")
  @HttpCode(200)
  async generatePaymentLink(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(createPaymentLinkQuerySchema))
    query: CreatePaymentLinkQuery,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.createPaymentLink.execute(id, query.businessId);
    return { data };
  }

  @Post(":id/start-follow-up")
  @HttpCode(200)
  async startFollowUpRoute(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(startFollowUpQuerySchema))
    query: StartFollowUpQuery,
    @Body(new ZodValidationPipe(startFollowUpBodySchema)) body: StartFollowUpBody,
  ) {
    await this.businessAuth.assertCallerOwnsBusiness(clerkUserId, query.businessId);
    const data = await this.startFollowUp.execute(id, query.businessId, body);
    return { data };
  }
}
