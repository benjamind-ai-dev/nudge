import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@nudge/database";
import { decrypt, STOPPED_REASONS } from "@nudge/shared";
import { type ProviderName } from "@nudge/connections-domain";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import { Env } from "../../../common/config/env.schema";
import {
  type BusinessActiveConnection,
  type DisconnectRepository,
  type DisconnectResult,
} from "../domain/disconnect.repository";

@Injectable()
export class PrismaDisconnectRepository implements DisconnectRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private key(): string {
    return this.config.get("ENCRYPTION_KEY", { infer: true });
  }

  async findActiveConnections(
    businessId: string,
  ): Promise<BusinessActiveConnection[]> {
    const rows = await this.prisma.connection.findMany({
      where: { businessId, status: "connected" },
      select: { id: true, provider: true, refreshToken: true },
    });
    const key = this.key();
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider as ProviderName,
      refreshToken: decrypt(row.refreshToken, key),
    }));
  }

  async runDisconnect(businessId: string): Promise<DisconnectResult> {
    const completedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      // 1. Stop active/paused sequence_runs. SequenceRun has no businessId
      //    column — scope through invoice.businessId.
      const stopped = await tx.sequenceRun.updateMany({
        where: {
          status: { in: ["active", "paused"] },
          invoice: { businessId },
        },
        data: {
          status: "stopped",
          stoppedReason: STOPPED_REASONS.MANUALLY_STOPPED,
          completedAt,
        },
      });

      // 2. Mark active connections revoked. status='connected' is what
      //    Connection.create() persists; the entity's markRevoked() target
      //    is 'revoked'. errorMessage matches the convention used by the
      //    refresh worker for user-initiated revocations.
      const revoked = await tx.connection.updateMany({
        where: { businessId, status: "connected" },
        data: { status: "revoked", errorMessage: "manually_disconnected" },
      });

      // 3. Soft-delete the business. PK lookup — no tenant scoping needed
      //    since the use case verified existence (findById) before invoking
      //    this method. Idempotent if isActive is already false.
      await tx.business.update({
        where: { id: businessId },
        data: { isActive: false },
      });

      return {
        stoppedRunCount: stopped.count,
        revokedConnectionCount: revoked.count,
      };
    });
  }
}
