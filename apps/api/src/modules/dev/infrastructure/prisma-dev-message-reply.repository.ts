import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type { DevMessageReplyRepository } from "../domain/dev-message-reply.repository";

@Injectable()
export class PrismaDevMessageReplyRepository
  implements DevMessageReplyRepository
{
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async markReplied(
    messageId: string,
    replyBody: string,
  ): Promise<{ businessId: string } | null> {
    try {
      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data: { replyBody, repliedAt: new Date() },
        select: { businessId: true },
      });
      return { businessId: updated.businessId };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return null;
      }
      throw err;
    }
  }
}
