import { Module } from "@nestjs/common";
import { TriggerSequencesUseCase } from "./application/trigger-sequences.use-case";
import { SEQUENCE_TRIGGER_REPOSITORY } from "./domain/sequence-trigger.repository";
import { PrismaSequenceTriggerRepository } from "./infrastructure/prisma-sequence-trigger.repository";
import { SequenceTriggerProcessor } from "./infrastructure/sequence-trigger.processor";

@Module({
  providers: [
    SequenceTriggerProcessor,
    TriggerSequencesUseCase,
    {
      provide: SEQUENCE_TRIGGER_REPOSITORY,
      useClass: PrismaSequenceTriggerRepository,
    },
  ],
})
export class SequenceTriggerModule {}
