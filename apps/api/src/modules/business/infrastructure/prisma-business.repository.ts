import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  type BusinessRepository,
  type BusinessWithConnections,
  type BusinessSettings,
  type CreateBusinessData,
  type UpdateBusinessSettingsData,
} from "../domain/business.repository";

const BUSINESS_WITH_CONNECTIONS_SELECT = {
  id: true,
  name: true,
  accountingProvider: true,
  senderName: true,
  senderEmail: true,
  emailSignature: true,
  timezone: true,
  isActive: true,
  lastSyncAt: true,
  connections: {
    select: {
      provider: true,
      status: true,
    },
  },
  _count: {
    select: {
      customers: true,
      invoices: true,
    },
  },
} as const;

const BUSINESS_SETTINGS_SELECT = {
  id: true,
  name: true,
  senderName: true,
  senderEmail: true,
  emailSignature: true,
  timezone: true,
} as const;

function toBusinessWithConnections(row: {
  id: string;
  name: string;
  accountingProvider: string;
  senderName: string;
  senderEmail: string;
  emailSignature: string | null;
  timezone: string;
  isActive: boolean;
  lastSyncAt: Date | null;
  connections: { provider: string; status: string }[];
  _count: { customers: number; invoices: number };
}): BusinessWithConnections {
  return {
    id: row.id,
    name: row.name,
    accountingProvider: row.accountingProvider,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    emailSignature: row.emailSignature,
    timezone: row.timezone,
    isActive: row.isActive,
    customerCount: row._count.customers,
    invoiceCount: row._count.invoices,
    connections: row.connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      lastSyncAt: row.lastSyncAt,
    })),
  };
}

@Injectable()
export class PrismaBusinessRepository implements BusinessRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findById(id: string): Promise<BusinessWithConnections | null> {
    const row = await this.prisma.business.findUnique({
      where: { id },
      select: BUSINESS_WITH_CONNECTIONS_SELECT,
    });
    return row ? toBusinessWithConnections(row) : null;
  }

  async create(data: CreateBusinessData): Promise<BusinessWithConnections> {
    const row = await this.prisma.business.create({
      data: {
        accountId: data.accountId,
        name: data.name,
        accountingProvider: data.accountingProvider,
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        timezone: data.timezone,
        emailSignature: data.emailSignature ?? null,
      },
      select: BUSINESS_WITH_CONNECTIONS_SELECT,
    });
    return toBusinessWithConnections(row);
  }

  async updateSettings(id: string, data: UpdateBusinessSettingsData): Promise<BusinessSettings> {
    return this.prisma.business.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.senderName !== undefined && { senderName: data.senderName }),
        ...(data.senderEmail !== undefined && { senderEmail: data.senderEmail }),
        ...(data.emailSignature !== undefined && { emailSignature: data.emailSignature }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
      },
      select: BUSINESS_SETTINGS_SELECT,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.business.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
