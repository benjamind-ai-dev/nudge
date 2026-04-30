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

  async stopRun(runId: string, businessId: string, reason: string): Promise<void> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id: runId, sequence: { businessId } },
      data: { status: "stopped", stoppedReason: reason },
    });

    if (result.count === 0) {
      throw new Error(
        `SequenceRun ${runId} not found for business ${businessId}`,
      );
    }
  }

  async pauseRun(runId: string, businessId: string, reason: string): Promise<void> {
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id: runId, sequence: { businessId } },
      data: { status: "paused", pausedReason: reason },
    });

    if (result.count === 0) {
      throw new Error(
        `SequenceRun ${runId} not found for business ${businessId}`,
      );
    }
  }
}
