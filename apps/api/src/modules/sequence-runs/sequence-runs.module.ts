import { Module } from "@nestjs/common";
import { SEQUENCE_RUN_REPOSITORY } from "./domain/sequence-run.repository";
import { PrismaSequenceRunRepository } from "./infrastructure/prisma-sequence-run.repository";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { SequenceRunsController } from "./sequence-runs.controller";

@Module({
  controllers: [SequenceRunsController],
  providers: [
    ListSequenceRunsUseCase,
    GetSequenceRunUseCase,
    { provide: SEQUENCE_RUN_REPOSITORY, useClass: PrismaSequenceRunRepository },
  ],
})
export class SequenceRunsModule {}
