import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../common/database/database.module";

import { AI_DRAFT_CLIENT } from "./application/ports/ai-draft.client";
import { AI_DRAFT_REPOSITORY } from "./application/ports/ai-draft.repository";
import { GenerateAiDraftUseCase } from "./application/generate-ai-draft.use-case";

import { VercelAiDraftClient } from "./infrastructure/vercel-ai-draft.client";
import { PrismaAiDraftRepository } from "./infrastructure/prisma-ai-draft.repository";
import { AiDraftProcessor } from "./infrastructure/processors/ai-draft.processor";

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    AiDraftProcessor,
    GenerateAiDraftUseCase,
    { provide: AI_DRAFT_CLIENT, useClass: VercelAiDraftClient },
    { provide: AI_DRAFT_REPOSITORY, useClass: PrismaAiDraftRepository },
  ],
})
export class AiDraftModule {}
