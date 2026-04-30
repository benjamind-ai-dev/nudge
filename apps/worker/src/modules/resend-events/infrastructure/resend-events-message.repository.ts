import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  MessageRecord,
  MessageStatus,
  ResendEventsMessageRepository,
} from "../domain/resend-events-message.repository";

@Injectable()
export class PrismaResendEventsMessageRepository
  implements ResendEventsMessageRepository
{
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findByExternalId(externalMessageId: string): Promise<MessageRecord | null> {
    // Cross-tenant read: Resend events carry only the external ID, not businessId.
    // businessId is extracted from the returned record and used for all subsequent writes.
    const row = await this.prisma.message.findFirst({
      where: { externalMessageId },
      select: {
        id: true,
        businessId: true,
        sequenceRunId: true,
        status: true,
        openedAt: true,
        clickedAt: true,
      },
    });

    if (!row) return null;

    return {
      ...row,
      status: row.status as MessageStatus,
    };
  }

  async updateStatus(id: string, businessId: string, status: MessageStatus): Promise<void> {
    const result = await this.prisma.message.updateMany({
      where: { id, businessId },
      data: { status },
    });

    if (result.count === 0) {
      throw new Error(
        `Message ${id} not found for business ${businessId}`,
      );
    }
  }

  async updateOpenedAt(id: string, businessId: string, openedAt: Date): Promise<void> {
    // Intentional: only sets openedAt when null (first-write-wins).
    // A count of 0 means it was already set — not an error.
    await this.prisma.message.updateMany({
      where: { id, businessId, openedAt: null },
      data: { openedAt },
    });
  }

  async updateClickedAt(id: string, businessId: string, clickedAt: Date): Promise<void> {
    // Intentional: only sets clickedAt when null (first-write-wins).
    // A count of 0 means it was already set — not an error.
    await this.prisma.message.updateMany({
      where: { id, businessId, clickedAt: null },
      data: { clickedAt },
    });
  }
}
