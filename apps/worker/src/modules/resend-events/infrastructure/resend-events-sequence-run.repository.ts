import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { ResendEventsSequenceRunRepository } from "../domain/resend-events-sequence-run.repository";

@Injectable()
export class PrismaResendEventsSequenceRunRepository
  implements ResendEventsSequenceRunRepository
{
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async stopRun(runId: string, _businessId: string, reason: string): Promise<void> {
    // runId is sourced from our own message record (already tenant-scoped at fetch time),
    // so filtering by id alone is safe. Prisma updateMany doesn't support relation filters in UPDATE.
    await this.prisma.sequenceRun.update({
      where: { id: runId },
      data: { status: "stopped", stoppedReason: reason },
    });
  }

  async pauseRun(runId: string, _businessId: string, reason: string): Promise<void> {
    await this.prisma.sequenceRun.update({
      where: { id: runId },
      data: { status: "paused", pausedReason: reason },
    });
  }
}
