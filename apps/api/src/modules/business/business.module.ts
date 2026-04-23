import { Module } from "@nestjs/common";
import { BUSINESS_REPOSITORY } from "./domain/business.repository";
import { PrismaBusinessRepository } from "./infrastructure/prisma-business.repository";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { BusinessController } from "./business.controller";

@Module({
  controllers: [BusinessController],
  providers: [
    GetBusinessUseCase,
    CreateBusinessUseCase,
    UpdateBusinessSettingsUseCase,
    DeleteBusinessUseCase,
    {
      provide: BUSINESS_REPOSITORY,
      useClass: PrismaBusinessRepository,
    },
  ],
})
export class BusinessModule {}
