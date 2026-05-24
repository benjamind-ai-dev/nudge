import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../common/database/database.module";

import {
  TEMPLATE_REPOSITORY,
  TEMPLATE_CUSTOMER_VERIFIER,
} from "./domain/template.repository";
import { AI_TEMPLATE_CLIENT } from "./application/ports/ai-template.client";
import { ListTemplatesUseCase } from "./application/list-templates.use-case";
import { GetTemplateUseCase } from "./application/get-template.use-case";
import { CreateTemplateUseCase } from "./application/create-template.use-case";
import { UpdateTemplateUseCase } from "./application/update-template.use-case";
import { DeleteTemplateUseCase } from "./application/delete-template.use-case";
import { GenerateTemplateUseCase } from "./application/generate-template.use-case";
import { AttachTemplateToCustomerUseCase } from "./application/attach-template-to-customer.use-case";
import { DetachTemplateFromCustomerUseCase } from "./application/detach-template-from-customer.use-case";
import { CreateDefaultTemplateUseCase } from "./application/create-default-template.use-case";

import {
  PrismaTemplateRepository,
  PrismaTemplateCustomerVerifier,
} from "./infrastructure/prisma-template.repository";
import { VercelAiTemplateClient } from "./infrastructure/vercel-ai-template.client";

import { TemplatesController } from "./templates.controller";

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [TemplatesController],
  providers: [
    ListTemplatesUseCase,
    GetTemplateUseCase,
    CreateTemplateUseCase,
    UpdateTemplateUseCase,
    DeleteTemplateUseCase,
    GenerateTemplateUseCase,
    AttachTemplateToCustomerUseCase,
    DetachTemplateFromCustomerUseCase,
    CreateDefaultTemplateUseCase,
    { provide: TEMPLATE_REPOSITORY, useClass: PrismaTemplateRepository },
    { provide: TEMPLATE_CUSTOMER_VERIFIER, useClass: PrismaTemplateCustomerVerifier },
    { provide: AI_TEMPLATE_CLIENT, useClass: VercelAiTemplateClient },
  ],
  exports: [CreateDefaultTemplateUseCase],
})
export class TemplatesModule {}
