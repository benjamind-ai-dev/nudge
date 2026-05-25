import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { TwilioEventsSequenceRunRepository } from "../domain/twilio-events.repositories";

@Injectable()
export class PrismaTwilioEventsSequenceRunRepository
  implements TwilioEventsSequenceRunRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async stopRun(runId: string, businessId: string, reason: string): Promise<boolean> {
    // Filter on status='active' so a run already stopped/paused by another flow
    // (payment, manual stop, prior reply) is not silently overwritten with
    // 'client_replied' — preserves the audit reason.
    const result = await this.prisma.sequenceRun.updateMany({
      where: { id: runId, status: "active", invoice: { businessId } },
      data: { status: "stopped", stoppedReason: reason },
    });
    return result.count > 0;
  }
}
