import { Module } from "@nestjs/common";
import { SEQUENCE_REPOSITORY } from "./domain/sequence.repository";
import { PrismaSequenceRepository } from "./infrastructure/prisma-sequence.repository";
import { ListSequencesUseCase } from "./application/list-sequences.use-case";
import { GetSequenceUseCase } from "./application/get-sequence.use-case";
import { CreateSequenceUseCase } from "./application/create-sequence.use-case";
import { UpdateSequenceUseCase } from "./application/update-sequence.use-case";
import { DeleteSequenceUseCase } from "./application/delete-sequence.use-case";
import { AddStepUseCase } from "./application/add-step.use-case";
import { UpdateStepUseCase } from "./application/update-step.use-case";
import { DeleteStepUseCase } from "./application/delete-step.use-case";
import { ReorderStepsUseCase } from "./application/reorder-steps.use-case";
import { SequencesController } from "./sequences.controller";

@Module({
  controllers: [SequencesController],
  providers: [
    ListSequencesUseCase,
    GetSequenceUseCase,
    CreateSequenceUseCase,
    UpdateSequenceUseCase,
    DeleteSequenceUseCase,
    AddStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    ReorderStepsUseCase,
    { provide: SEQUENCE_REPOSITORY, useClass: PrismaSequenceRepository },
  ],
})
export class SequencesModule {}
