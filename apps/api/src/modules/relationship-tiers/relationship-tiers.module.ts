import { Module } from "@nestjs/common";
import { RELATIONSHIP_TIER_REPOSITORY } from "./domain/relationship-tier.repository";
import { PrismaRelationshipTierRepository } from "./infrastructure/prisma-relationship-tier.repository";
import { ListTiersUseCase } from "./application/list-tiers.use-case";
import { CreateTierUseCase } from "./application/create-tier.use-case";
import { UpdateTierUseCase } from "./application/update-tier.use-case";
import { DeleteTierUseCase } from "./application/delete-tier.use-case";
import { RelationshipTiersController } from "./relationship-tiers.controller";

@Module({
  controllers: [RelationshipTiersController],
  providers: [
    ListTiersUseCase,
    CreateTierUseCase,
    UpdateTierUseCase,
    DeleteTierUseCase,
    { provide: RELATIONSHIP_TIER_REPOSITORY, useClass: PrismaRelationshipTierRepository },
  ],
})
export class RelationshipTiersModule {}
