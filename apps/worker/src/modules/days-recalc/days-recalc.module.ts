import { Module } from "@nestjs/common";
import { RecalculateDaysOverdueUseCase } from "./application/recalculate-days-overdue.use-case";
import { DAYS_RECALC_REPOSITORY } from "./domain/days-recalc.repository";
import { PrismaDaysRecalcRepository } from "./infrastructure/prisma-days-recalc.repository";
import { DaysRecalcProcessor } from "./infrastructure/days-recalc.processor";

@Module({
  providers: [
    DaysRecalcProcessor,
    RecalculateDaysOverdueUseCase,
    {
      provide: DAYS_RECALC_REPOSITORY,
      useClass: PrismaDaysRecalcRepository,
    },
  ],
})
export class DaysRecalcModule {}
