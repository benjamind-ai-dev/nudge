import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { SequenceRunNotFoundError } from "./domain/sequence-run.errors";
import {
  getSequenceRunQuerySchema,
  listSequenceRunsQuerySchema,
  type GetSequenceRunQuery,
  type ListSequenceRunsQuery,
} from "./dto/sequence-runs.dto";

@Controller("v1/sequence-runs")
export class SequenceRunsController {
  constructor(
    private readonly listSequenceRuns: ListSequenceRunsUseCase,
    private readonly getSequenceRun: GetSequenceRunUseCase,
  ) {}

  @Get()
  async list(
    @AccountId() _accountId: string,
    @Query(new ZodValidationPipe(listSequenceRunsQuerySchema)) query: ListSequenceRunsQuery,
  ) {
    return this.listSequenceRuns.execute(query);
  }

  @Get(":id")
  async get(
    @AccountId() _accountId: string,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(getSequenceRunQuerySchema)) query: GetSequenceRunQuery,
  ) {
    try {
      const data = await this.getSequenceRun.execute(id, query.businessId);
      return { data };
    } catch (error) {
      if (error instanceof SequenceRunNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
