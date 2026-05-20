import { Module } from "@nestjs/common";
import { SEQUENCE_RUN_REPOSITORY } from "./domain/sequence-run.repository";
import { PrismaSequenceRunRepository } from "./infrastructure/prisma-sequence-run.repository";
import { ListSequenceRunsUseCase } from "./application/list-sequence-runs.use-case";
import { GetSequenceRunUseCase } from "./application/get-sequence-run.use-case";
import { PauseSequenceRunUseCase } from "./application/pause-sequence-run.use-case";
import { ResumeSequenceRunUseCase } from "./application/resume-sequence-run.use-case";
import { StopSequenceRunUseCase } from "./application/stop-sequence-run.use-case";
import { SequenceRunsController } from "./sequence-runs.controller";

@Module({
  controllers: [SequenceRunsController],
  providers: [
    ListSequenceRunsUseCase,
    GetSequenceRunUseCase,
    PauseSequenceRunUseCase,
    ResumeSequenceRunUseCase,
    StopSequenceRunUseCase,
    { provide: SEQUENCE_RUN_REPOSITORY, useClass: PrismaSequenceRunRepository },
  ],
})
export class SequenceRunsModule {}
