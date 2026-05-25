import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { TwilioEventsSequenceRunRepository } from "../domain/twilio-events.repositories";

@Injectable()
export class PrismaTwilioEventsSequenceRunRepository
  implements TwilioEventsSequenceRunRepository
{
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async stopRun(runId: string, businessId: string, reason: string): Promise<void> {
    await this.prisma.sequenceRun.updateMany({
      where: { id: runId, invoice: { businessId } },
      data: { status: "stopped", stoppedReason: reason },
    });
  }
}
