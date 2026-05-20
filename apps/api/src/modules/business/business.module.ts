import { Module } from "@nestjs/common";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";
import { BUSINESS_REPOSITORY } from "./domain/business.repository";
import { DISCONNECT_REPOSITORY } from "./domain/disconnect.repository";
import { PrismaBusinessRepository } from "./infrastructure/prisma-business.repository";
import { PrismaDisconnectRepository } from "./infrastructure/prisma-disconnect.repository";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { BusinessController } from "./business.controller";

@Module({
  imports: [ConnectionsCommonModule],
  controllers: [BusinessController],
  providers: [
    GetBusinessUseCase,
    CreateBusinessUseCase,
    UpdateBusinessSettingsUseCase,
    DeleteBusinessUseCase,
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    { provide: DISCONNECT_REPOSITORY, useClass: PrismaDisconnectRepository },
  ],
})
export class BusinessModule {}
