import {
  Module,
  Global,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@nudge/database";

export const PRISMA_CLIENT = Symbol("PRISMA_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: (): PrismaClient => {
        return new PrismaClient();
      },
    },
  ],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit() {
    await this.prisma.$connect();
    this.logger.log("Database connected");
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
