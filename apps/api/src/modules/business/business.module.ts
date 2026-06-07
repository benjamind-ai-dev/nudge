import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@nudge/shared";
import { CONNECTION_REPOSITORY } from "@nudge/connections-domain";
import { ConnectionsCommonModule } from "../connections-common/connections-common.module";
import { PrismaConnectionRepository } from "../connections-common/infrastructure/prisma-connection.repository";
import { TemplatesModule } from "../templates/templates.module";
import { BUSINESS_REPOSITORY } from "./domain/business.repository";
import { ACCOUNT_READER } from "./domain/account-reader";
import { DISCONNECT_REPOSITORY } from "./domain/disconnect.repository";
import { PrismaBusinessRepository } from "./infrastructure/prisma-business.repository";
import { PrismaDisconnectRepository } from "./infrastructure/prisma-disconnect.repository";
import { PrismaAccountReader } from "./infrastructure/prisma-account-reader";
import { SyncRateLimitService } from "./infrastructure/sync-rate-limit.service";
import { GetBusinessUseCase } from "./application/get-business.use-case";
import { CreateBusinessUseCase } from "./application/create-business.use-case";
import { UpdateBusinessSettingsUseCase } from "./application/update-business-settings.use-case";
import { DeleteBusinessUseCase } from "./application/delete-business.use-case";
import { TriggerManualSyncUseCase } from "./application/trigger-manual-sync.use-case";
import { BusinessController } from "./business.controller";

@Module({
  imports: [
    ConnectionsCommonModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INVOICE_SYNC }),
    TemplatesModule,
  ],
  controllers: [BusinessController],
  providers: [
    GetBusinessUseCase,
    CreateBusinessUseCase,
    UpdateBusinessSettingsUseCase,
    DeleteBusinessUseCase,
    TriggerManualSyncUseCase,
    SyncRateLimitService,
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    { provide: ACCOUNT_READER, useClass: PrismaAccountReader },
    { provide: DISCONNECT_REPOSITORY, useClass: PrismaDisconnectRepository },
    { provide: CONNECTION_REPOSITORY, useClass: PrismaConnectionRepository },
  ],
})
export class BusinessModule {}
