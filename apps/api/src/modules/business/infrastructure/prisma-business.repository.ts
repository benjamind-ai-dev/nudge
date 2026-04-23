import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  type BusinessRepository,
  type BusinessSettings,
  type UpdateBusinessSettingsData,
  type BusinessWithConnections,
  type CreateBusinessData,
} from "../domain/business.repository";

@Injectable()
export class PrismaBusinessRepository implements BusinessRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findById(id: string): Promise<BusinessWithConnections | null> {
    const row = await this.prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        accountingProvider: true,
        senderName: true,
        senderEmail: true,
        emailSignature: true,
        timezone: true,
        isActive: true,
        connections: {
          select: {
            provider: true,
            status: true,
            lastRefreshAt: true,
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      accountingProvider: row.accountingProvider,
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      emailSignature: row.emailSignature,
      timezone: row.timezone,
      isActive: row.isActive,
      connections: row.connections.map((conn) => ({
        provider: conn.provider,
        status: conn.status,
        lastSyncAt: conn.lastRefreshAt,
      })),
    };
  }

  async create(data: CreateBusinessData): Promise<BusinessWithConnections> {
    const created = await this.prisma.business.create({
      data: {
        accountId: data.accountId,
        name: data.name,
        accountingProvider: data.accountingProvider,
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        timezone: data.timezone,
        emailSignature: data.emailSignature,
      },
      select: {
        id: true,
        name: true,
        accountingProvider: true,
        senderName: true,
        senderEmail: true,
        emailSignature: true,
        timezone: true,
        isActive: true,
        connections: {
          select: {
            provider: true,
            status: true,
            lastRefreshAt: true,
          },
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      accountingProvider: created.accountingProvider,
      senderName: created.senderName,
      senderEmail: created.senderEmail,
      emailSignature: created.emailSignature,
      timezone: created.timezone,
      isActive: created.isActive,
      connections: created.connections.map((conn) => ({
        provider: conn.provider,
        status: conn.status,
        lastSyncAt: conn.lastRefreshAt,
      })),
    };
  }

  async updateSettings(id: string, data: UpdateBusinessSettingsData): Promise<BusinessSettings> {
    return this.prisma.business.update({
      where: { id },
      data: {
        ...(data.senderName !== undefined && { senderName: data.senderName }),
        ...(data.senderEmail !== undefined && { senderEmail: data.senderEmail }),
        ...(data.emailSignature !== undefined && { emailSignature: data.emailSignature }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
      },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        emailSignature: true,
        timezone: true,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.business.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
