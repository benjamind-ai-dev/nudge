import { Module } from "@nestjs/common";
import { SEQUENCE_REPOSITORY } from "./domain/sequence.repository";
import { PrismaSequenceRepository } from "./infrastructure/prisma-sequence.repository";
import { ENROLLMENT_REPOSITORY } from "./domain/enrollment.repository";
import { PrismaEnrollmentRepository } from "./infrastructure/prisma-enrollment.repository";
import { EnrollInvoicesUseCase } from "./application/enroll-invoices.use-case";
import { ListSequencesUseCase } from "./application/list-sequences.use-case";
import { GetSequenceUseCase } from "./application/get-sequence.use-case";
import { CreateSequenceUseCase } from "./application/create-sequence.use-case";
import { UpdateSequenceUseCase } from "./application/update-sequence.use-case";
import { DeleteSequenceUseCase } from "./application/delete-sequence.use-case";
import { ReplaceSequenceUseCase } from "./application/replace-sequence.use-case";
import { AddStepUseCase } from "./application/add-step.use-case";
import { UpdateStepUseCase } from "./application/update-step.use-case";
import { DeleteStepUseCase } from "./application/delete-step.use-case";
import { ReorderStepsUseCase } from "./application/reorder-steps.use-case";
import { PreviewStepUseCase } from "./application/preview-step.use-case";
import { AttachCustomerUseCase } from "./application/attach-customer.use-case";
import { PauseSequenceUseCase } from "./application/pause-sequence.use-case";
import { ActivateSequenceUseCase } from "./application/activate-sequence.use-case";
import { SequencesController } from "./sequences.controller";
import { RELATIONSHIP_TIER_REPOSITORY } from "../relationship-tiers/domain/relationship-tier.repository";
import { PrismaRelationshipTierRepository } from "../relationship-tiers/infrastructure/prisma-relationship-tier.repository";
import { TEMPLATE_REPOSITORY } from "../templates/domain/template.repository";
import { PrismaTemplateRepository } from "../templates/infrastructure/prisma-template.repository";
import { TEMPLATE_SERVICE } from "../../common/template/template.service";
import { HandlebarsTemplateService } from "../../common/template/handlebars-template.service";

@Module({
  controllers: [SequencesController],
  providers: [
    ListSequencesUseCase,
    GetSequenceUseCase,
    CreateSequenceUseCase,
    UpdateSequenceUseCase,
    DeleteSequenceUseCase,
    ReplaceSequenceUseCase,
    AddStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    ReorderStepsUseCase,
    PreviewStepUseCase,
    EnrollInvoicesUseCase,
    AttachCustomerUseCase,
    PauseSequenceUseCase,
    ActivateSequenceUseCase,
    { provide: SEQUENCE_REPOSITORY, useClass: PrismaSequenceRepository },
    { provide: ENROLLMENT_REPOSITORY, useClass: PrismaEnrollmentRepository },
    { provide: RELATIONSHIP_TIER_REPOSITORY, useClass: PrismaRelationshipTierRepository },
    { provide: TEMPLATE_REPOSITORY, useClass: PrismaTemplateRepository },
    { provide: TEMPLATE_SERVICE, useClass: HandlebarsTemplateService },
  ],
})
export class SequencesModule {}
